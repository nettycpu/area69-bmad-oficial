require "net/http"
require "json"
require "aws-sdk-s3"
require "securerandom"

module Api
  class GenerateController < ApplicationController
    WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3"
    QWEN_MODEL         = "wavespeed-ai/qwen-image-2.0-pro/edit"
    SEEDANCE_MODEL     = "bytedance/seedance-v1.5-pro/image-to-video"

    COST_PER_IMAGE     = 5
    COST_PER_VIDEO     = 30

    SIZE_MAP = {
      ["1:1",  "480p"]  => "480*480",
      ["1:1",  "720p"]  => "720*720",
      ["1:1",  "1080p"] => "1024*1024",
      ["16:9", "480p"]  => "854*480",
      ["16:9", "720p"]  => "1280*720",
      ["16:9", "1080p"] => "1920*1080",
      ["9:16", "480p"]  => "480*854",
      ["9:16", "720p"]  => "720*1280",
      ["9:16", "1080p"] => "1080*1920",
      ["4:3",  "480p"]  => "640*480",
      ["4:3",  "720p"]  => "960*720",
      ["4:3",  "1080p"] => "1440*1080",
      ["3:4",  "480p"]  => "480*640",
      ["3:4",  "720p"]  => "720*960",
      ["3:4",  "1080p"] => "1080*1440",
      ["21:9", "480p"]  => "840*360",
      ["21:9", "720p"]  => "1260*540",
      ["21:9", "1080p"] => "2048*878",
    }.freeze

    def create_image
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      prompt = params[:prompt].to_s.strip
      images = Array(params[:images])
      aspect = params[:aspect_ratio].to_s
      res    = params[:resolution].to_s
      seed   = params[:seed]

      return render_error("Prompt é obrigatório") if prompt.blank?
      return render_error("Imagem de referência é obrigatória") if images.empty?
      return render_error("Máximo de 6 imagens de referência") if images.size > 6

      size = SIZE_MAP[[aspect, res]] || "1024*1024"

      # Deduct credits atomically
      updated = User.where(id: current_user.id)
                    .where("credits >= ?", COST_PER_IMAGE)
                    .update_all(["credits = credits - ?", COST_PER_IMAGE])
      return render_error("Créditos insuficientes", :payment_required) if updated == 0

      payload = { prompt: prompt, images: images, size: size }
      payload[:seed] = seed.to_i if seed.present? && seed.to_s != "-1"

      body, status = wavespeed_post("#{WAVESPEED_API_BASE}/#{QWEN_MODEL}", payload, api_key)

      if status == 200
        data = body["data"] || body
        render json: { prediction_id: data["id"], status: data["status"] }
      else
        current_user.increment!(:credits, COST_PER_IMAGE)
        error_msg = provider_friendly_error(body)
        render_error(error_msg, :bad_gateway)
      end
    rescue => e
      current_user.increment!(:credits, COST_PER_IMAGE)
      render_error("Falha na geração: #{e.message}", :internal_server_error)
    end

    def image_status
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      prediction_id = params[:id]
      body, status = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{prediction_id}/result", api_key)

      if status == 200
        data = body["data"] || body
        render json: {
          status:  data["status"],
          outputs: data["outputs"] || [],
          error:   data["error"],
        }
      else
        render_error(body["message"] || "Erro ao verificar status", :bad_gateway)
      end
    rescue => e
      render_error("Erro ao verificar status: #{e.message}", :internal_server_error)
    end

    def create_video
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      prompt         = params[:prompt].to_s.strip
      image          = params[:image].to_s
      aspect_ratio   = params[:aspect_ratio].to_s.presence || "16:9"
      duration       = [[params[:duration].to_i, 4].max, 12].min
      resolution     = params[:resolution].to_s.presence || "720p"
      generate_audio = params[:generate_audio] != false
      camera_fixed   = params[:camera_fixed] == true
      seed           = params[:seed]

      return render_error("Prompt é obrigatório") if prompt.blank?
      return render_error("Imagem de referência é obrigatória") if image.blank?

      payload = {
        prompt:         prompt,
        image:          image,
        aspect_ratio:   aspect_ratio,
        duration:       duration,
        resolution:     resolution,
        generate_audio: generate_audio,
        camera_fixed:   camera_fixed,
        seed:           seed.present? ? seed.to_i : -1,
      }

      # Deduct credits atomically
      updated = User.where(id: current_user.id)
                    .where("credits >= ?", COST_PER_VIDEO)
                    .update_all(["credits = credits - ?", COST_PER_VIDEO])
      return render_error("Créditos insuficientes", :payment_required) if updated == 0

      body, status = wavespeed_post("#{WAVESPEED_API_BASE}/#{SEEDANCE_MODEL}", payload, api_key)

      if status == 200
        data = body["data"] || body
        render json: { prediction_id: data["id"], status: data["status"] }
      else
        current_user.increment!(:credits, COST_PER_VIDEO)
        render_error(body["message"] || body["error"] || "WaveSpeed API error", :bad_gateway)
      end
    rescue => e
      current_user.increment!(:credits, COST_PER_VIDEO)
      render_error("Falha na geração: #{e.message}", :internal_server_error)
    end

    def video_status
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      prediction_id = params[:id]
      body, status = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{prediction_id}/result", api_key)

      if status == 200
        data = body["data"] || body
        render json: {
          status:  data["status"],
          outputs: data["outputs"] || [],
          error:   data["error"],
        }
      else
        render_error(body["message"] || "Erro ao verificar status", :bad_gateway)
      end
    rescue => e
      render_error("Erro ao verificar status: #{e.message}", :internal_server_error)
    end

    # ─────────────────────────── Higgsfield AI ─────────────────────────────

    def create_higgsfield
      model_id     = params[:model_id].to_s
      prompt       = params[:prompt].to_s.strip
      images       = Array(params[:images])
      seed         = params[:seed]
      aspect_ratio = params[:aspect_ratio].to_s.presence || "9:16"
      resolution   = params[:resolution].to_s.presence || "720p"

      return render_error("Modelo é obrigatório") if model_id.blank?

      model = current_user.avatar_models.find_by!(id: model_id)
      return render_error("Modelo não está pronto — Soul ID não encontrado. Conclua o treinamento primeiro.") unless model.soul_id.present? && model.status == "ready"

      return render_error("Prompt é obrigatório") if prompt.blank?
      return render_error("Máximo de 6 imagens de referência") if images.size > 6

      # Se imagens forem data URLs (base64), fazer upload para R2 primeiro
      if images.any? { |img| img.start_with?("data:") }
        public_urls = upload_images_to_r2(model, images)
        images = public_urls
      end

      # Deduct credits atomically
      updated = User.where(id: current_user.id)
                    .where("credits >= ?", COST_PER_IMAGE)
                    .update_all(["credits = credits - ?", COST_PER_IMAGE])
      return render_error("Créditos insuficientes", :payment_required) if updated == 0

      options = {}
      options[:images]       = images if images.any?
      options[:seed]         = seed.to_i if seed.present? && seed.to_s != "-1"
      options[:aspect_ratio] = aspect_ratio
      options[:resolution]   = resolution

      service = HiggsfieldService.new
      result  = service.generate_image(soul_id: model.soul_id, prompt: prompt, **options)

      model.increment!(:images_generated)

      render json: {
        prediction_id: result[:request_id],
        status: result[:status],
        credits: current_user.reload.credits
      }
    rescue HiggsfieldService::APIError => e
      current_user.increment!(:credits, COST_PER_IMAGE)
      credits = current_user.reload.credits
      msg = e.message.to_s
      if msg.downcase.include?("model not found") || msg.downcase.include?("custom reference nao encontrado")
        render json: {
          error: "Modelo Higgsfield não encontrado para geração. O Soul ID pode pertencer a outra conta/API key ou o endpoint de geração precisa ser ajustado.",
          credits: credits
        }, status: :bad_gateway
      else
        render json: { error: msg, credits: credits }, status: :bad_gateway
      end
    rescue HiggsfieldService::TimeoutError => e
      current_user.increment!(:credits, COST_PER_IMAGE)
      render_error(e.message, :gateway_timeout)
    rescue HiggsfieldService::Error => e
      current_user.increment!(:credits, COST_PER_IMAGE)
      render_error(e.message, :service_unavailable)
    rescue ActiveRecord::RecordNotFound
      render_error("Modelo não encontrado", :not_found)
    rescue => e
      current_user.increment!(:credits, COST_PER_IMAGE)
      render_error("Falha na geração: #{e.message}", :internal_server_error)
    end

    def higgsfield_status
      prediction_id = params[:id]
      result = HiggsfieldService.new.generation_status(prediction_id)

      render json: {
        status:  result[:status],
        outputs: result[:outputs] || [],
        error:   result[:error]
      }
    rescue HiggsfieldService::APIError => e
      render_error(e.message, :bad_gateway)
    rescue HiggsfieldService::TimeoutError => e
      render_error(e.message, :gateway_timeout)
    rescue => e
      render_error("Erro ao verificar status: #{e.message}", :internal_server_error)
    end

    private

    def build_http(uri, read_timeout: 60)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl      = true
      http.read_timeout = read_timeout
      http.verify_mode  = OpenSSL::SSL::VERIFY_PEER
      http.ca_file      = OpenSSL::X509::DEFAULT_CERT_FILE if File.exist?(OpenSSL::X509::DEFAULT_CERT_FILE.to_s)
      # Disable CRL checking — CRL distribution points unreachable in this environment
      store = OpenSSL::X509::Store.new
      store.set_default_paths
      store.flags = OpenSSL::X509::V_FLAG_CRL_CHECK_ALL ^ OpenSSL::X509::V_FLAG_CRL_CHECK_ALL
      http.cert_store = store
      http
    end

    def wavespeed_post(url, payload, api_key)
      uri  = URI(url)
      http = build_http(uri, read_timeout: 60)

      req = Net::HTTP::Post.new(uri)
      req["Authorization"] = "Bearer #{api_key}"
      req["Content-Type"]  = "application/json"
      req.body = payload.to_json

      resp = http.request(req)
      [JSON.parse(resp.body), resp.code.to_i]
    end

    def wavespeed_get(url, api_key)
      uri  = URI(url)
      http = build_http(uri, read_timeout: 30)

      req = Net::HTTP::Get.new(uri)
      req["Authorization"] = "Bearer #{api_key}"

      resp = http.request(req)
      [JSON.parse(resp.body), resp.code.to_i]
    end

    # Retorna mensagem amigavel quando o provedor (WaveSpeed) esta sem saldo
    def provider_friendly_error(body)
      raw = body["message"].to_s + " " + body["error"].to_s
      raw_down = raw.downcase
      if raw_down.include?("insufficient credits") || raw_down.include?("top up") || raw_down.include?("insufficient balance")
        "Serviço de imagem temporariamente indisponível: saldo do provedor insuficiente."
      else
        body["message"] || body["error"] || "WaveSpeed API error"
      end
    end

    # Upload de imagens base64 para R2 (compartilhado com TrainingController)
    def upload_images_to_r2(model, images)
      public_host = ENV.fetch("R2_PUBLIC_URL_HOST")
      bucket_name = ENV.fetch("R2_BUCKET")
      raise "R2_PUBLIC_URL_HOST nao configurado" if public_host.blank?
      raise "R2_BUCKET nao configurado" if bucket_name.blank?

      s3 = Aws::S3::Resource.new(
        region: "auto",
        endpoint: ENV.fetch("R2_ENDPOINT"),
        access_key_id: ENV.fetch("R2_ACCESS_KEY_ID"),
        secret_access_key: ENV.fetch("R2_SECRET_ACCESS_KEY")
      )

      mime_to_ext = {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        "image/gif"  => "gif",
        "image/avif" => "avif",
        "image/tiff" => "tiff",
      }.freeze

      bucket = s3.bucket(bucket_name)
      keys = []

      images.each_with_index do |data_url, index|
        mime = data_url[/^data:([^;]+);/, 1] || "image/png"
        raw  = data_url.split(",", 2).second || data_url
        decoded = Base64.decode64(raw)
        ext = mime_to_ext[mime] || "jpg"

        key = "generate/#{model.id}/#{SecureRandom.uuid}.#{ext}"

        bucket.object(key).put(
          body: decoded,
          content_type: mime
        )

        keys << key
      end

      keys.map { |key| "#{public_host}/#{key}" }
    end
  end
end
