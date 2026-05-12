require "net/http"
require "uri"
require "json"
require "openssl"

class HiggsfieldService
  HIGGSFIELD_BASE = "https://platform.higgsfield.ai"
  SOUL_STANDARD_MODEL = "/higgsfield-ai/soul/standard"

  class Error < StandardError; end

  class APIError < Error
    attr_reader :status_code

    def initialize(message, status_code = nil)
      super(message)
      @status_code = status_code
    end
  end

  class TimeoutError < Error; end

  def initialize
    @api_key    = ENV.fetch("HIGGSFIELD_API_KEY", "")
    @api_secret = ENV.fetch("HIGGSFIELD_API_SECRET", "")
    raise Error, "HIGGSFIELD_API_KEY e HIGGSFIELD_API_SECRET devem estar definidos" if @api_key.blank? || @api_secret.blank?
  end

  # ────────────────────────────── Geração ────────────────────────────────

  # Verifica se um custom reference existe na API Higgsfield
  def custom_reference(reference_id)
    body, status = get("/v1/custom-references/#{reference_id}")
    Rails.logger.info("[Higgsfield] GET custom reference id=#{reference_id.to_s[0..20]}... status=#{status}")
    {
      id:     body["id"] || body["reference_id"],
      status: body["status"],
      name:   body["name"],
      raw_body: body
    }
  rescue APIError => e
    Rails.logger.info("[Higgsfield] GET custom reference id=#{reference_id.to_s[0..20]}... FAILED status=#{e.status_code}")
    raise
  end

  # Submete job de geração de imagem usando um Soul ID já treinado
  # Usa o endpoint oficial: POST /higgsfield-ai/soul/standard
  def generate_image(soul_id:, prompt:, **options)
    reference_id = soul_id.to_s

    # Antes de gerar, valida se o custom reference existe e está pronto
    begin
      ref = custom_reference(reference_id)
      unless ref[:status] == "completed" || ref[:status] == "ready"
        raise APIError.new("Custom Reference #{reference_id[0..12]}... status=#{ref[:status]}, aguarde o treinamento concluir.")
      end
      Rails.logger.info("[Higgsfield] Reference validated: id=#{reference_id[0..20]}... status=#{ref[:status]}")
    rescue APIError => e
      raise APIError.new("Custom Reference nao encontrado na Higgsfield (reference_id=#{reference_id[0..12]}...). Recrie o modelo.", e.status_code)
    end

    payload = {
      prompt: prompt,
      aspect_ratio: options[:aspect_ratio] || "9:16",
      resolution: options[:resolution] || "720p",
      custom_reference: reference_id,
      custom_reference_strength: options[:custom_reference_strength] || 1
    }

    payload[:images] = options[:images] if options[:images].present?
    payload[:seed] = options[:seed].to_i if options[:seed].present? && options[:seed].to_s != "-1"

    payload_keys = payload.keys.inspect
    Rails.logger.info("[Higgsfield] POST model=#{SOUL_STANDARD_MODEL} reference=#{reference_id[0..12]}... keys=#{payload_keys} prompt=#{prompt.truncate(120).inspect}")

    body, status = post(SOUL_STANDARD_MODEL, payload)

    {
      request_id: body["request_id"] || body["id"] || body.dig("data", "request_id") || body.dig("data", "id"),
      status:     body["status"] || body.dig("data", "status") || "queued",
      raw_body:   body
    }
  end

  # Verifica o status de um job de GERACAO (retorna outputs)
  def generation_status(request_id)
    body, status = get("/requests/#{request_id}/status")

    unless status == 200
      raise APIError.new(body["error"] || body["message"] || "Erro ao verificar status", status)
    end

    outputs = if body["outputs"].is_a?(Array)
                body["outputs"].map { |o| o.is_a?(Hash) ? o["url"] : o }.compact
              elsif body["images"].is_a?(Array)
                body["images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
              else
                []
              end

    {
      status:  body["status"],
      outputs: outputs,
      error:   body["error"]
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield no status")
  end

  # ───────────────────────────── Treino ──────────────────────────────────

  # Submete imagens para criar um Custom Reference (Soul ID)
  # Endpoint oficial: POST /v1/custom-references
  def train_soul(name:, image_urls:)
    input_images = image_urls.map { |url| { type: "image_url", image_url: url } }

    payload = {
      name: name,
      input_images: input_images
    }

    body, status = post("/v1/custom-references", payload)

    unless status == 200 || status == 201
      raise APIError.new(body["error"] || body["message"] || "Higgsfield training failed", status)
    end

    # A API retorna "id" como identificador principal do custom-reference,
    # nao necessariamente "request_id"
    ref_id = body["reference_id"] || body["id"]

    {
      request_id:   body["request_id"] || ref_id,
      reference_id: ref_id,
      status:       body["status"] || "not_ready",
      raw_body:     body
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield no treino")
  end

  # Verifica status de um job de TREINO
  # Quando completed, retorna o ID do modelo (reference_id / id / dentro de results)
  def training_status(id)
    # Primeiro tenta o endpoint de custom-references (retorna status do treino)
    body, status = get("/v1/custom-references/#{id}")
    status_normalized = normalize_training_status(body["status"])

    reference_id = body["reference_id"] || body["id"]
    reference_id ||= body.dig("results", "reference_id") if body["results"].is_a?(Hash)

    {
      status:        status_normalized,
      request_id:    body["request_id"] || id,
      reference_id:  reference_id || id,
      images:        body["images"] || body["input_images"] || [],
      error:         body["error"],
      raw_body:      body
    }
  rescue APIError => e
    # Fallback: se o endpoint de custom-references falhar (ex: 404),
    # tenta o endpoint legado /requests/:id/status
    if e.status_code == 404
      begin
        body, status = get("/requests/#{id}/status")

        reference_id = body["reference_id"] || body["id"]
        reference_id ||= body.dig("results", "reference_id") if body["results"].is_a?(Hash)

        return {
          status:        normalize_training_status(body["status"]),
          request_id:    body["request_id"] || id,
          reference_id:  reference_id || id,
          images:        body["images"] || [],
          error:         body["error"],
          raw_body:      body
        }
      rescue => fallback_e
        raise APIError.new("Erro ao verificar status: #{fallback_e.message}")
      end
    end
    raise
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield no status de treino")
  end

  private

  # Normaliza os diversos status possiveis da API Higgsfield
  def normalize_training_status(status)
    case status.to_s.downcase
    when "completed", "ready"
      "completed"
    when "not_ready", "training", "processing", "queued", "in_progress"
      "training"
    when "failed", "nsfw", "error"
      "failed"
    else
      status.presence || "training"
    end
  end

  # ─────────────────────── HTTP Helpers ──────────────────────────────────
  # Espelhados do padrao Wavespeed em Api::GenerateController

  def auth_header
    "Key #{@api_key}:#{@api_secret}"
  end

  def build_http(uri, read_timeout: 60)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl      = true
    http.read_timeout = read_timeout
    http.verify_mode  = OpenSSL::SSL::VERIFY_PEER

    if File.exist?(OpenSSL::X509::DEFAULT_CERT_FILE.to_s)
      http.ca_file = OpenSSL::X509::DEFAULT_CERT_FILE
    end

    # Desabilita CRL — distribuicao de CRL inalcancavel no ambiente
    store = OpenSSL::X509::Store.new
    store.set_default_paths
    store.flags = OpenSSL::X509::V_FLAG_CRL_CHECK_ALL ^ OpenSSL::X509::V_FLAG_CRL_CHECK_ALL
    http.cert_store = store

    http
  end

  def post(path, payload, read_timeout: 60)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = auth_header
    req["Content-Type"]  = "application/json"
    req.body = payload.to_json

    resp = http.request(req)
    Rails.logger.info("Higgsfield Response: #{resp.code} - #{resp.body.truncate(500)}")
    raise APIError.new("Higgsfield API Error: #{resp.body}", resp.code) unless resp.is_a?(Net::HTTPSuccess)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Higgsfield API timeout apos #{read_timeout}s (#{path})"
  end

  # Como post, mas NAO levanta excecao em erro HTTP — retorna body+status
  def post_raw(path, payload, read_timeout: 60)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = auth_header
    req["Content-Type"]  = "application/json"
    req.body = payload.to_json

    resp = http.request(req)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Higgsfield API timeout apos #{read_timeout}s (#{path})"
  rescue JSON::ParserError
    [{ "error" => "Resposta malformada da Higgsfield", "raw" => resp&.body.to_s }, resp&.code.to_i]
  end

  def get(path, read_timeout: 30)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Get.new(uri)
    req["Authorization"] = auth_header

    resp = http.request(req)
    Rails.logger.info("Higgsfield Response: #{resp.code} - #{resp.body}")
    raise APIError.new("Higgsfield API Error: #{resp.body}", resp.code) unless resp.is_a?(Net::HTTPSuccess)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Higgsfield API timeout apos #{read_timeout}s (#{path})"
  end
end
