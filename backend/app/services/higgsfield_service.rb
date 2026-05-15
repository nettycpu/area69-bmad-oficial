require "net/http"
require "uri"
require "json"
require "openssl"

class HiggsfieldService
  HIGGSFIELD_BASE = "https://platform.higgsfield.ai"
  SOUL_CHARACTER_MODEL = "/higgsfield-ai/soul/character"
  REALISTIC_SOUL_STYLE_ID = "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe".freeze

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
  # Usa o endpoint oficial: POST /higgsfield-ai/soul/character
  def generate_image(soul_id:, prompt:, **options)
    character_id = soul_id.to_s
    ref = nil

    # Antes de gerar, valida se o custom reference (character) existe e está pronto
    begin
      ref = custom_reference(character_id)
      unless ref[:status] == "completed" || ref[:status] == "ready"
        raise APIError.new("Character #{character_id[0..12]}... status=#{ref[:status]}, aguarde o treinamento concluir.")
      end
      Rails.logger.info("[Higgsfield] Character validated: id=#{character_id[0..20]}... status=#{ref[:status]}")
    rescue APIError => e
      raise APIError.new("Modelo treinado nao encontrado. Recrie o modelo.", e.status_code)
    end

    reference_name = options[:custom_reference_name].presence || ref[:name].presence || "AREA69 Character"
    payload = {
      prompt: prompt,
      aspect_ratio: options[:aspect_ratio] || "9:16",
      resolution: options[:resolution] || "720p",
      custom_reference_id: character_id,
      custom_reference_strength: options[:custom_reference_strength] || options[:character_strength] || 1,
      style_id: options[:style_id].presence || REALISTIC_SOUL_STYLE_ID,
      style_strength: options[:style_strength] || 1,
      batch_size: options[:result_images] || options[:batch_size] || 1,
      enhance_prompt: options.key?(:enhance_prompt) ? options[:enhance_prompt] : true
    }

    raise APIError, "custom_reference_id ausente" if payload[:custom_reference_id].blank?

    # Imagem de referência opcional — enviar URL pública
    if options[:images].present?
      first_image = options[:images].is_a?(Array) ? options[:images].first : options[:images]
      payload[:image_reference_url] = first_image
    end

    if options[:seed].present? && options[:seed].to_s != "-1"
      payload[:seed] = options[:seed].to_i
    end

    payload[:soul_style] = options[:soul_style] if options[:soul_style].present?

    Rails.logger.info(
      "[Higgsfield] Soul Character payload " \
      "custom_reference_id=#{payload[:custom_reference_id].to_s[0..12]}... " \
      "custom_reference_name=#{reference_name.inspect} " \
      "custom_reference_strength=#{payload[:custom_reference_strength]} " \
      "style_id=#{payload[:style_id]} " \
      "batch_size=#{payload[:batch_size]} " \
      "image_reference_url=#{payload.key?(:image_reference_url) ? "present" : "absent"} " \
      "prompt=#{payload[:prompt].to_s.truncate(160).inspect}"
    )

    body, status = post(SOUL_CHARACTER_MODEL, payload)

    {
      request_id: body["request_id"] || body["id"] || body.dig("data", "request_id") || body.dig("data", "id"),
      status:     body["status"] || body.dig("data", "status") || "queued",
      raw_body:   body
    }
  end

  # Verifica o status de um job de GERACAO (retorna outputs)
  # Tenta extrair outputs de: body["outputs"], body["images"][].url,
  # body.dig("data", "outputs"), body.dig("data", "images")[].url
  def generation_status(request_id)
    body, status = get("/requests/#{request_id}/status")

    unless status == 200
      raise APIError.new(body["error"] || body["message"] || "Erro ao verificar status", status)
    end

    data = body["data"] || body

    outputs = if data["outputs"].is_a?(Array)
                data["outputs"].map { |o| o.is_a?(Hash) ? o["url"] : o }.compact
              elsif data["images"].is_a?(Array)
                data["images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
              elsif data.dig("result_images").is_a?(Array)
                data["result_images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
              else
                []
              end

    {
      status:  data["status"],
      outputs: outputs,
      error:   data["error"]
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada do servico de geracao no status")
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
      raise APIError.new(body["error"] || body["message"] || "Falha ao treinar modelo AREA69", status)
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
    raise APIError.new("Resposta malformada do servico de treinamento")
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
    raise APIError.new("Resposta malformada do servico de treinamento no status")
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
    raise APIError.new("Servico AREA69 temporariamente indisponivel", resp.code) unless resp.is_a?(Net::HTTPSuccess)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Servico AREA69 demorou mais que o esperado"
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
    raise TimeoutError, "Servico AREA69 demorou mais que o esperado"
  rescue JSON::ParserError
    [{ "error" => "Resposta malformada do servico de geracao", "raw" => resp&.body.to_s }, resp&.code.to_i]
  end

  def get(path, read_timeout: 30)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Get.new(uri)
    req["Authorization"] = auth_header

    resp = http.request(req)
    Rails.logger.info("Higgsfield Response: #{resp.code} - #{resp.body}")
    raise APIError.new("Servico AREA69 temporariamente indisponivel", resp.code) unless resp.is_a?(Net::HTTPSuccess)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Servico AREA69 demorou mais que o esperado"
  end
end
