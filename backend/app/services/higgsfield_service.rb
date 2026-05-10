require "net/http"
require "uri"
require "json"
require "openssl"

class HiggsfieldService
  HIGGSFIELD_BASE = "https://platform.higgsfield.ai"

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

  # Submete job de geração de imagem usando um Soul ID já treinado
  def generate_image(soul_id:, prompt:, **options)
    payload = { soul_id: soul_id, prompt: prompt }.merge(options)

    body, status = post("/v1/soul/generate", payload)

    unless status == 200 || status == 201
      raise APIError.new(body["error"] || body["message"] || "Higgsfield generation failed", status)
    end

    {
      request_id: body["request_id"] || body.dig("data", "request_id"),
      status:     body["status"] || "processing"
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield na geracao")
  end

  # Verifica o status de um job de GERACAO (retorna outputs)
  def generation_status(request_id)
    body, status = get("/requests/#{request_id}/status")

    unless status == 200
      raise APIError.new(body["error"] || body["message"] || "Erro ao verificar status", status)
    end

    {
      status:  body["status"],
      outputs: body["outputs"] || [],
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

    {
      request_id: body["request_id"],
      status:     body["status"]
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield no treino")
  end

  # Verifica status de um job de TREINO
  # Quando completed, retorna o ID do modelo (reference_id / id / dentro de results)
  def training_status(request_id)
    body, status = get("/requests/#{request_id}/status")

    unless status == 200
      raise APIError.new(body["error"] || body["message"] || "Erro ao verificar status", status)
    end

    # O ID do modelo treinado pode vir em campos diferentes segundo a doc
    reference_id = body["reference_id"] || body["id"]
    reference_id ||= body.dig("results", "reference_id") if body["results"].is_a?(Hash)

    {
      status:        body["status"],
      request_id:    body["request_id"],
      reference_id:  reference_id,
      images:        body["images"] || [],
      error:         body["error"],
      raw_body:      body
    }
  rescue JSON::ParserError
    raise APIError.new("Resposta malformada da Higgsfield no status de treino")
  end

  private

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
    Rails.logger.info("Higgsfield Response: #{resp.code} - #{resp.body}")
    raise APIError.new("Higgsfield API Error: #{resp.body}", resp.code) unless resp.is_a?(Net::HTTPSuccess)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError, "Higgsfield API timeout apos #{read_timeout}s (#{path})"
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
