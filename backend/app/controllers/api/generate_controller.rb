require "net/http"
require "json"
require "aws-sdk-s3"
require "securerandom"

module Api
  class GenerateController < ApplicationController
    WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3"
    QWEN_MODEL         = "wavespeed-ai/qwen-image-2.0-pro/edit"
    SEEDANCE_MODEL     = "bytedance/seedance-v1.5-pro/image-to-video"

    ASPECT_RATIOS = %w[1:1 3:4 4:5 9:16 16:9 21:9 4:3 3:4].freeze
    RESOLUTIONS   = %w[480p 720p 1080p].freeze

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

    # ─────────────────────────── Qwen Image ─────────────────────────────────

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

      job = current_user.generation_jobs.create!(
        provider: "wavespeed",
        provider_model: QWEN_MODEL,
        generation_type: "image",
        status: "queued",
        cost_credits: Pricing::QWEN_IMAGE,
        prompt: prompt,
        input_urls: images,
        aspect_ratio: aspect.presence,
        resolution: res.presence,
        seed: seed,
        idempotency_key: "gen:image:#{SecureRandom.uuid}"
      )

      # Cobrar
      CreditLedger.spend!(
        user: current_user,
        amount: Pricing::QWEN_IMAGE,
        source: "qwen_image",
        idempotency_key: "generation_job:#{job.id}:charge",
        reference: job
      )
      job.update!(charged_at: Time.current)

      payload = { prompt: prompt, images: images, size: size }
      payload[:seed] = seed.to_i if seed.present? && seed.to_s != "-1"

      body, status = wavespeed_post("#{WAVESPEED_API_BASE}/#{QWEN_MODEL}", payload, api_key)

      if status == 200
        data = body["data"] || body
        provider_id = data["id"]
        job.update!(provider_request_id: provider_id, status: "submitted")
        render json: {
          job_id: job.id,
          prediction_id: provider_id,
          status: job.status,
          credits: current_user.reload.credits
        }
      else
        refund_job(job)
        error_msg = provider_friendly_error(body)
        render json: { error: error_msg, credits: current_user.reload.credits }, status: :bad_gateway
      end
    rescue CreditLedger::InsufficientCredits
      render_error("Créditos insuficientes", :payment_required)
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    def image_status
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      job = find_job(params[:id])
      return render_error("Job não encontrado", :not_found) unless job

      body, status = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{job.provider_request_id}/result", api_key)

      if status == 200
        data = body["data"] || body
        process_completed(job, data)
      else
        render json: {
          status: job.status,
          outputs: job.output_urls,
          credits: current_user.reload.credits
        }
      end
    rescue => e
      render_error("Erro ao verificar status: #{e.message}", :internal_server_error)
    end

    # ─────────────────────────── Seedance Video ─────────────────────────────

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

      job = current_user.generation_jobs.create!(
        provider: "wavespeed",
        provider_model: SEEDANCE_MODEL,
        generation_type: "video",
        status: "queued",
        cost_credits: Pricing::SEEDANCE_VIDEO,
        prompt: prompt,
        input_urls: [image],
        aspect_ratio: aspect_ratio,
        resolution: resolution,
        duration: duration,
        seed: seed,
        thumbnail_url: image,
        idempotency_key: "gen:video:#{SecureRandom.uuid}"
      )

      # Cobrar
      CreditLedger.spend!(
        user: current_user,
        amount: Pricing::SEEDANCE_VIDEO,
        source: "seedance_video",
        idempotency_key: "generation_job:#{job.id}:charge",
        reference: job
      )
      job.update!(charged_at: Time.current)

      payload = {
        prompt: prompt, image: image, aspect_ratio: aspect_ratio,
        duration: duration, resolution: resolution,
        generate_audio: generate_audio, camera_fixed: camera_fixed,
        seed: seed.present? ? seed.to_i : -1,
      }

      body, status = wavespeed_post("#{WAVESPEED_API_BASE}/#{SEEDANCE_MODEL}", payload, api_key)

      if status == 200
        data = body["data"] || body
        provider_id = data["id"]
        job.update!(provider_request_id: provider_id, status: "submitted")
        render json: {
          job_id: job.id,
          prediction_id: provider_id,
          status: job.status,
          credits: current_user.reload.credits
        }
      else
        refund_job(job)
        render json: { error: body["message"] || body["error"] || "WaveSpeed API error", credits: current_user.reload.credits }, status: :bad_gateway
      end
    rescue CreditLedger::InsufficientCredits
      render_error("Créditos insuficientes", :payment_required)
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    def video_status
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Serviço de geração não configurado", :service_unavailable) unless api_key.present?

      job = find_job(params[:id])
      return render_error("Job não encontrado", :not_found) unless job

      body, status = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{job.provider_request_id}/result", api_key)

      if status == 200
        data = body["data"] || body
        process_completed(job, data)
      else
        render json: {
          status: job.status,
          outputs: job.output_urls,
          credits: current_user.reload.credits
        }
      end
    rescue => e
      render_error("Erro ao verificar status: #{e.message}", :internal_server_error)
    end

    # ─────────────────────────── Higgsfield Soul Character ──────────────────

    def create_higgsfield
      model_id          = params[:model_id].to_s
      prompt            = params[:prompt].to_s.strip
      images            = Array(params[:images])
      seed              = params[:seed]
      aspect_ratio      = params[:aspect_ratio].to_s.presence || "9:16"
      resolution        = params[:resolution].to_s.presence || "720p"
      character_strength = params[:character_strength] || 1
      result_images     = params[:result_images] || 1
      enhance_prompt    = params.key?(:enhance_prompt) ? params[:enhance_prompt] : true

      return render_error("Modelo é obrigatório") if model_id.blank?

      model = current_user.avatar_models.find_by!(id: model_id)
      return render_error("Modelo não está pronto — Character ID não encontrado. Conclua o treinamento primeiro.") unless model.soul_id.present? && model.status == "ready"

      return render_error("Prompt é obrigatório") if prompt.blank?
      return render_error("Máximo de 6 imagens de referência") if images.size > 6

      # Upload imagens base64 para R2
      if images.any? { |img| img.start_with?("data:") }
        public_urls = upload_images_to_r2(model, images)
        images = public_urls
      end

      job = current_user.generation_jobs.create!(
        provider: "higgsfield",
        provider_model: "higgsfield-ai/soul/character",
        generation_type: "image",
        status: "queued",
        cost_credits: Pricing::HIGGSFIELD_CHARACTER,
        prompt: prompt,
        input_urls: images,
        aspect_ratio: aspect_ratio,
        resolution: resolution,
        seed: seed,
        avatar_model: model,
        idempotency_key: "gen:higgsfield:#{SecureRandom.uuid}"
      )

      # Cobrar
      CreditLedger.spend!(
        user: current_user,
        amount: Pricing::HIGGSFIELD_CHARACTER,
        source: "higgsfield_character",
        idempotency_key: "generation_job:#{job.id}:charge",
        reference: job
      )
      job.update!(charged_at: Time.current)

      options = {
        aspect_ratio: aspect_ratio,
        resolution: resolution,
        character_strength: character_strength.to_f,
        result_images: result_images.to_i,
        enhance_prompt: enhance_prompt,
        images: images,
        seed: seed
      }

      service = HiggsfieldService.new
      result  = service.generate_image(soul_id: model.soul_id, prompt: prompt, **options)

      provider_id = result[:request_id]
      job.update!(provider_request_id: provider_id, status: "submitted")
      model.increment!(:images_generated)

      render json: {
        job_id: job.id,
        prediction_id: provider_id,
        status: job.status,
        credits: current_user.reload.credits
      }
    rescue HiggsfieldService::APIError => e
      refund_job(job) if job&.persisted?
      credits = current_user.reload.credits
      msg = e.message.to_s
      if msg.downcase.include?("not found") || msg.downcase.include?("character nao encontrado")
        render json: { error: "Character ID não encontrado na Higgsfield. Recrie o modelo.", credits: credits }, status: :bad_gateway
      else
        render json: { error: msg, credits: credits }, status: :bad_gateway
      end
    rescue HiggsfieldService::TimeoutError => e
      refund_job(job) if job&.persisted?
      render_error(e.message, :gateway_timeout)
    rescue HiggsfieldService::Error => e
      refund_job(job) if job&.persisted?
      render_error(e.message, :service_unavailable)
    rescue ActiveRecord::RecordNotFound
      render_error("Modelo não encontrado", :not_found)
    rescue CreditLedger::InsufficientCredits
      render_error("Créditos insuficientes", :payment_required)
    end

    def higgsfield_status
      job = find_job(params[:id])
      return render_error("Job não encontrado", :not_found) unless job

      result = HiggsfieldService.new.generation_status(job.provider_request_id)

      if result[:status] == "completed" && result[:outputs].any?
        process_completed(job, { "outputs" => result[:outputs], "status" => "completed" })
      elsif result[:status] == "failed"
        process_failed(job, result[:error])
      else
        render json: { status: result[:status], outputs: job.output_urls, credits: current_user.reload.credits }
      end
    rescue HiggsfieldService::APIError => e
      render_error(e.message, :bad_gateway)
    rescue HiggsfieldService::TimeoutError => e
      render_error(e.message, :gateway_timeout)
    end

    private

    def find_job(id_or_request_id)
      job = current_user.generation_jobs.find_by(id: id_or_request_id)
      job ||= current_user.generation_jobs.find_by(provider_request_id: id_or_request_id)
      job
    end

    def process_completed(job, data)
      outputs = extract_outputs(data)

      job.update!(
        status: "completed",
        output_urls: outputs,
        completed_at: Time.current
      )

      # Criar Generation exatamente uma vez
      if outputs.any? && !job.metadata.dig("generation_created")
        outputs.each do |url|
          current_user.generations.find_or_create_by!(
            model_name: job.avatar_model&.name || job.provider_model,
            generation_type: job.generation_type,
            prompt: job.prompt,
            url: url,
            generation_job_id: job.id,
            thumbnail_url: job.thumbnail_url,
            provider: job.provider,
            provider_model: job.provider_model,
            aspect_ratio: job.aspect_ratio,
            resolution: job.resolution,
            duration: job.duration
          )
        end
        job.update!(metadata: job.metadata.merge("generation_created" => true))

        # Incrementar contadores de user (apenas uma vez)
        unless job.metadata.dig("counters_updated")
          column = job.generation_type == "image" ? :images_generated : :videos_generated
          current_user.increment!(column, outputs.size)
          job.update!(metadata: job.metadata.merge("counters_updated" => true))
        end
      end

      render json: {
        status: "completed",
        outputs: outputs,
        credits: current_user.reload.credits
      }
    end

    def process_failed(job, error_message)
      job.update!(status: "failed", error_message: error_message)

      # Reembolso idempotente
      unless job.refunded_at
        CreditLedger.refund!(
          user: current_user,
          amount: job.cost_credits,
          source: job.source_for_refund,
          idempotency_key: "generation_job:#{job.id}:refund",
          reference: job,
          metadata: { error: error_message }
        )
        job.update!(refunded_at: Time.current)
      end

      render json: {
        status: "failed",
        error: error_message,
        outputs: job.output_urls,
        credits: current_user.reload.credits
      }
    end

    def refund_job(job)
      job.update!(status: "failed", error_message: "Submit failed")
      return if job.refunded_at

      CreditLedger.refund!(
        user: current_user,
        amount: job.cost_credits,
        source: job.source_for_refund,
        idempotency_key: "generation_job:#{job.id}:refund",
        reference: job,
        metadata: { error: "submit_failed" }
      )
      job.update!(refunded_at: Time.current)
    rescue => e
      Rails.logger.error("[Generate] Erro ao reembolsar job #{job.id}: #{e.message}")
    end

    def extract_outputs(data)
      outputs = []
      if data["outputs"].is_a?(Array)
        outputs = data["outputs"].map { |o| o.is_a?(Hash) ? o["url"] : o }.compact
      elsif data["images"].is_a?(Array)
        outputs = data["images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
      elsif data["result_images"].is_a?(Array)
        outputs = data["result_images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
      end
      outputs
    end

    # ─────────────────────────── HTTP / Upload helpers ──────────────────────

    def build_http(uri, read_timeout: 60)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl      = true
      http.read_timeout = read_timeout
      http.verify_mode  = OpenSSL::SSL::VERIFY_PEER
      http.ca_file      = OpenSSL::X509::DEFAULT_CERT_FILE if File.exist?(OpenSSL::X509::DEFAULT_CERT_FILE.to_s)
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

    def provider_friendly_error(body)
      raw = body["message"].to_s + " " + body["error"].to_s
      raw_down = raw.downcase
      if raw_down.include?("insufficient credits") || raw_down.include?("top up") || raw_down.include?("insufficient balance")
        "Serviço de imagem temporariamente indisponível: saldo do provedor insuficiente."
      else
        body["message"] || body["error"] || "WaveSpeed API error"
      end
    end

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
        "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp",
        "image/gif" => "gif", "image/avif" => "avif", "image/tiff" => "tiff",
      }.freeze

      bucket = s3.bucket(bucket_name)
      keys = []

      images.each_with_index do |data_url, index|
        mime = data_url[/^data:([^;]+);/, 1] || "image/png"
        raw  = data_url.split(",", 2).second || data_url
        decoded = Base64.decode64(raw)
        ext = mime_to_ext[mime] || "jpg"
        key = "generate/#{model.id}/#{SecureRandom.uuid}.#{ext}"
        bucket.object(key).put(body: decoded, content_type: mime)
        keys << key
      end

      keys.map { |key| "#{public_host}/#{key}" }
    end
  end
end
