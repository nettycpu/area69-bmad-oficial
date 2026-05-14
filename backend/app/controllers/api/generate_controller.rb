require "net/http"
require "json"
require "aws-sdk-s3"
require "securerandom"

module Api
  class GenerateController < ApplicationController
    rescue_from UploadValidator::ValidationError do |e|
      render json: { error: e.message }, status: :unprocessable_entity
    end

    WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3"
    QWEN_MODEL         = "wavespeed-ai/qwen-image-2.0-pro/edit"
    SEEDANCE_MODEL     = "bytedance/seedance-v1.5-pro/image-to-video"

    ASPECT_RATIOS = %w[21:9 16:9 4:3 1:1 3:4 9:16].freeze
    RESOLUTIONS   = %w[480p 720p 1080p].freeze
    HIGGSFIELD_ASPECT_RATIOS = %w[1:1 3:4 4:5 9:16 16:9].freeze
    HIGGSFIELD_RESOLUTIONS = %w[720p 1080p].freeze
    MAX_PROMPT_LENGTH = 800
    MIN_PROMPT_LENGTH = 3
    MAX_SEED = 2_147_483_647
    BOOLEAN_PARAM = ActiveModel::Type::Boolean.new

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
      return render_error("Servico de geracao nao configurado", :service_unavailable) unless api_key.present?

      prompt = params[:prompt].to_s.strip
      images = Array(params[:images])
      aspect = params[:aspect_ratio].to_s
      res    = params[:resolution].to_s
      seed   = params[:seed]

      return render_error("Prompt e obrigatorio") if prompt.blank?
      return render_error("Prompt deve ter pelo menos #{MIN_PROMPT_LENGTH} caracteres") if prompt.length < MIN_PROMPT_LENGTH
      return render_error("Prompt deve ter no maximo #{MAX_PROMPT_LENGTH} caracteres") if prompt.length > MAX_PROMPT_LENGTH
      return render_error("Imagem de referencia e obrigatoria") if images.empty?
      return render_error("Proporcao invalida") unless ASPECT_RATIOS.include?(aspect)
      return render_error("Resolucao invalida") unless RESOLUTIONS.include?(res)
      validate_seed!(seed)
      UploadValidator.validate_reference_inputs(images, max: 6)
      size = SIZE_MAP.fetch([aspect, res])

      job = nil
      ActiveRecord::Base.transaction do
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

        CreditLedger.spend!(
          user: current_user,
          amount: Pricing::QWEN_IMAGE,
          source: "qwen_image",
          idempotency_key: "generation_job:#{job.id}:charge",
          reference: job
        )
        job.update!(charged_at: Time.current, status: "processing")
      end

      payload = { prompt: prompt, images: images, size: size }
      payload[:seed] = seed.to_i if seed.present? && seed.to_s != "-1"

      body, status_code = wavespeed_post("#{WAVESPEED_API_BASE}/#{QWEN_MODEL}", payload, api_key)

      if status_code != 200
        refund_job(job)
        error_msg = provider_friendly_error(body)
        render json: { error: error_msg, credits: current_user.reload.credits }, status: :bad_gateway
        return
      end

      normalized = normalize_wavespeed_payload(body)
      job.update!(provider_request_id: normalized[:provider_id])

      if normalized[:status] == "completed" && normalized[:outputs].any?
        result = complete_job!(job, outputs: normalized[:outputs])
        render json: {
          job_id: job.id,
          prediction_id: normalized[:provider_id],
          status: result[:status],
          outputs: result[:outputs],
          credits: result[:credits]
        }
      else
        job.update!(status: "submitted")
        render json: {
          job_id: job.id,
          prediction_id: normalized[:provider_id],
          status: job.status,
          credits: current_user.reload.credits
        }
      end
    rescue CreditLedger::InsufficientCredits
      render json: { error: "Creditos insuficientes", credits: current_user.reload.credits }, status: :payment_required
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    def image_status
      job = find_job(params[:id])
      return render_error("Job nao encontrado", :not_found) unless job
      if terminal_status_response(job)
        ensure_generation_history!(job) if job.status == "completed"
        return render json: status_payload(job)
      end

      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Servico de geracao nao configurado", :service_unavailable) unless api_key.present?
      return render json: status_payload(job) if job.provider_request_id.blank?

      Rails.logger.info("[GenerateStatus] job=#{job.id} provider=#{job.provider} request=#{job.provider_request_id} status=#{job.status}")

      body, status_code = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{job.provider_request_id}/result", api_key)
      normalized = normalize_wavespeed_payload(body)

      case status_code
      when 200
        if normalized[:status] == "completed" && normalized[:outputs].any?
          Rails.logger.info("[GenerateStatus] provider completed job=#{job.id} outputs=#{normalized[:outputs].size}")
          result = complete_job!(job, outputs: normalized[:outputs])
          render json: {
            status: result[:status],
            outputs: result[:outputs],
            credits: result[:credits]
          }
        elsif normalized[:status] == "failed"
          render json: fail_job!(job, normalized[:error] || "Provider returned failed status")
        else
          mark_processing!(job)
          render json: processing_payload(job)
        end
      when 404, 429, 502, 503
        Rails.logger.warn("[WaveSpeed] Status #{status_code} transitorio para job #{job.id}")
        mark_processing!(job)
        render json: processing_payload(job)
      else
        if normalized[:status] == "failed" || normalized[:error].present?
          render json: fail_job!(job, normalized[:error] || "Provider returned error")
        else
          mark_processing!(job)
          render json: processing_payload(job)
        end
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNRESET, JSON::ParserError => e
      Rails.logger.warn("[WaveSpeed] Transient error para job #{job&.id}: #{e.class} — #{e.message[0..200]}")
      mark_processing!(job) if job
      render json: processing_payload(job)
    rescue => e
      internal_error_response(job, e)
    end

    # ─────────────────────────── Seedance Video ─────────────────────────────

    def create_video
      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Servico de geracao nao configurado", :service_unavailable) unless api_key.present?

      prompt         = params[:prompt].to_s.strip
      image          = params[:image].to_s
      aspect_ratio   = params[:aspect_ratio].to_s.presence || "16:9"
      duration       = Integer(params[:duration].presence || 5, exception: false)
      resolution     = params[:resolution].to_s.presence || "720p"
      generate_audio = BOOLEAN_PARAM.cast(params.key?(:generate_audio) ? params[:generate_audio] : true)
      camera_fixed   = BOOLEAN_PARAM.cast(params[:camera_fixed])
      seed           = params[:seed]

      return render_error("Prompt e obrigatorio") if prompt.blank?
      return render_error("Prompt deve ter pelo menos #{MIN_PROMPT_LENGTH} caracteres") if prompt.length < MIN_PROMPT_LENGTH
      return render_error("Prompt deve ter no maximo #{MAX_PROMPT_LENGTH} caracteres") if prompt.length > MAX_PROMPT_LENGTH
      return render_error("Imagem de referencia e obrigatoria") if image.blank?
      return render_error("Duracao invalida") unless duration&.between?(4, 12)
      return render_error("Proporcao invalida") unless ASPECT_RATIOS.include?(aspect_ratio)
      return render_error("Resolucao invalida") unless RESOLUTIONS.include?(resolution)
      validate_seed!(seed)
      UploadValidator.validate_reference_input(image)

      job = nil
      ActiveRecord::Base.transaction do
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

        CreditLedger.spend!(
          user: current_user,
          amount: Pricing::SEEDANCE_VIDEO,
          source: "seedance_video",
          idempotency_key: "generation_job:#{job.id}:charge",
          reference: job
        )
        job.update!(charged_at: Time.current, status: "processing")
      end

      payload = {
        prompt: prompt, image: image, aspect_ratio: aspect_ratio,
        duration: duration, resolution: resolution,
        generate_audio: generate_audio, camera_fixed: camera_fixed,
        seed: seed.present? ? seed.to_i : -1,
      }

      body, status_code = wavespeed_post("#{WAVESPEED_API_BASE}/#{SEEDANCE_MODEL}", payload, api_key)

      if status_code != 200
        refund_job(job)
        render json: { error: provider_friendly_error(body), credits: current_user.reload.credits }, status: :bad_gateway
        return
      end

      normalized = normalize_wavespeed_payload(body)
      job.update!(provider_request_id: normalized[:provider_id])

      if normalized[:status] == "completed" && normalized[:outputs].any?
        result = complete_job!(job, outputs: normalized[:outputs])
        render json: {
          job_id: job.id,
          prediction_id: normalized[:provider_id],
          status: result[:status],
          outputs: result[:outputs],
          credits: result[:credits]
        }
      else
        job.update!(status: "submitted")
        render json: {
          job_id: job.id,
          prediction_id: normalized[:provider_id],
          status: job.status,
          credits: current_user.reload.credits
        }
      end
    rescue CreditLedger::InsufficientCredits
      render json: { error: "Creditos insuficientes", credits: current_user.reload.credits }, status: :payment_required
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    def video_status
      job = find_job(params[:id])
      return render_error("Job nao encontrado", :not_found) unless job
      if terminal_status_response(job)
        ensure_generation_history!(job) if job.status == "completed"
        return render json: status_payload(job)
      end

      api_key = ENV["WAVESPEED_API_KEY"]
      return render_error("Servico de geracao nao configurado", :service_unavailable) unless api_key.present?
      return render json: status_payload(job) if job.provider_request_id.blank?

      Rails.logger.info("[GenerateStatus] job=#{job.id} provider=#{job.provider} request=#{job.provider_request_id} status=#{job.status}")

      body, status_code = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{job.provider_request_id}/result", api_key)
      normalized = normalize_wavespeed_payload(body)

      case status_code
      when 200
        if normalized[:status] == "completed" && normalized[:outputs].any?
          Rails.logger.info("[GenerateStatus] provider completed job=#{job.id} outputs=#{normalized[:outputs].size}")
          result = complete_job!(job, outputs: normalized[:outputs])
          render json: {
            status: result[:status],
            outputs: result[:outputs],
            credits: result[:credits]
          }
        elsif normalized[:status] == "failed"
          render json: fail_job!(job, normalized[:error] || "Provider returned failed status")
        else
          mark_processing!(job)
          render json: processing_payload(job)
        end
      when 404, 429, 502, 503
        Rails.logger.warn("[WaveSpeed] Status #{status_code} transitorio para job #{job.id}")
        mark_processing!(job)
        render json: processing_payload(job)
      else
        if normalized[:status] == "failed" || normalized[:error].present?
          render json: fail_job!(job, normalized[:error] || "Provider returned error")
        else
          mark_processing!(job)
          render json: processing_payload(job)
        end
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNRESET, JSON::ParserError => e
      Rails.logger.warn("[WaveSpeed] Transient error para job #{job&.id}: #{e.class} — #{e.message[0..200]}")
      mark_processing!(job) if job
      render json: processing_payload(job)
    rescue => e
      internal_error_response(job, e)
    end

    # ─────────────────────────── Higgsfield Soul Character ──────────────────

    def create_higgsfield
      model_id          = params[:model_id].to_s
      prompt            = params[:prompt].to_s.strip
      images            = Array(params[:images])
      seed              = params[:seed]
      aspect_ratio      = params[:aspect_ratio].to_s.presence || "9:16"
      resolution        = params[:resolution].to_s.presence || "720p"
      character_strength = Float(params[:character_strength].presence || 1, exception: false)
      result_images     = Integer(params[:result_images].presence || 1, exception: false) || 1
      enhance_prompt    = BOOLEAN_PARAM.cast(params.key?(:enhance_prompt) ? params[:enhance_prompt] : true)
      cost_credits      = Pricing::HIGGSFIELD_CHARACTER * result_images

      return render_error("Modelo e obrigatorio") if model_id.blank?
      return render_error("Quantidade de resultados invalida") unless [1, 4].include?(result_images)
      return render_error("Proporcao invalida") unless HIGGSFIELD_ASPECT_RATIOS.include?(aspect_ratio)
      return render_error("Resolucao invalida") unless HIGGSFIELD_RESOLUTIONS.include?(resolution)
      return render_error("Fidelidade do modelo invalida") unless character_strength&.between?(0.0, 1.0)
      validate_seed!(seed)

      model = current_user.avatar_models.find_by!(id: model_id)
      return render_error("Modelo nao esta pronto — Character ID nao encontrado. Conclua o treinamento primeiro.") unless model.soul_id.present? && model.status == "ready"

      return render_error("Prompt e obrigatorio") if prompt.blank?
      return render_error("Prompt deve ter pelo menos #{MIN_PROMPT_LENGTH} caracteres") if prompt.length < MIN_PROMPT_LENGTH
      return render_error("Prompt deve ter no maximo #{MAX_PROMPT_LENGTH} caracteres") if prompt.length > MAX_PROMPT_LENGTH
      return render_error("Maximo de 6 imagens de referencia") if images.size > 6
      UploadValidator.validate_reference_inputs(images, max: 6) if images.any?
      raise CreditLedger::InsufficientCredits if current_user.credits < cost_credits

      if images.any? { |img| img.start_with?("data:") }
        public_urls = upload_images_to_r2(model, images)
        images = public_urls
      end

      job = nil
      ActiveRecord::Base.transaction do
        job = current_user.generation_jobs.create!(
          provider: "higgsfield",
          provider_model: "higgsfield-ai/soul/character",
          generation_type: "image",
          status: "queued",
          cost_credits: cost_credits,
          prompt: prompt,
          input_urls: images,
          aspect_ratio: aspect_ratio,
          resolution: resolution,
          seed: seed,
          avatar_model: model,
          idempotency_key: "gen:higgsfield:#{SecureRandom.uuid}"
        )

        CreditLedger.spend!(
          user: current_user,
          amount: cost_credits,
          source: "higgsfield_character",
          idempotency_key: "generation_job:#{job.id}:charge",
          reference: job
        )
        job.update!(charged_at: Time.current, status: "processing")
      end

      options = {
        aspect_ratio: aspect_ratio,
        resolution: resolution,
        character_strength: character_strength,
        result_images: result_images,
        enhance_prompt: enhance_prompt,
        images: images,
        seed: seed
      }

      service = HiggsfieldService.new
      result  = service.generate_image(soul_id: model.soul_id, prompt: prompt, **options)

      provider_id = result[:request_id]
      job.update!(provider_request_id: provider_id, status: "submitted")

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
        render json: { error: "Modelo treinado nao encontrado. Recrie o modelo.", credits: credits }, status: :bad_gateway
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
      render_error("Modelo nao encontrado", :not_found)
    rescue CreditLedger::InsufficientCredits
      render json: { error: "Creditos insuficientes", credits: current_user.reload.credits }, status: :payment_required
    end

    def higgsfield_status
      job = find_job(params[:id])
      return render_error("Job nao encontrado", :not_found) unless job
      if terminal_status_response(job)
        ensure_generation_history!(job) if job.status == "completed"
        return render json: status_payload(job)
      end
      return render json: status_payload(job) if job.provider_request_id.blank?

      Rails.logger.info("[GenerateStatus] job=#{job.id} provider=#{job.provider} request=#{job.provider_request_id} status=#{job.status}")

      result = HiggsfieldService.new.generation_status(job.provider_request_id)

      if result[:status] == "completed" && result[:outputs].any?
        r = complete_job!(job, outputs: result[:outputs])
        render json: { status: r[:status], outputs: r[:outputs], credits: r[:credits] }
      elsif result[:status] == "failed"
        render json: fail_job!(job, result[:error])
      else
        mark_processing!(job)
        render json: { status: "processing", outputs: job.output_urls, credits: current_user.reload.credits }
      end
    rescue HiggsfieldService::APIError => e
      Rails.logger.warn("[Higgsfield] APIError transitorio: #{e.message[0..200]}")
      mark_processing!(job) if job
      render json: { status: "processing", outputs: job&.output_urls || [], credits: current_user&.reload&.credits }
    rescue HiggsfieldService::TimeoutError => e
      Rails.logger.warn("[Higgsfield] Timeout transitorio: #{e.message[0..200]}")
      mark_processing!(job) if job
      render json: { status: "processing", outputs: job&.output_urls || [], credits: current_user&.reload&.credits }
    rescue => e
      internal_error_response(job, e)
    end

    private

    def validate_seed!(seed)
      return true if seed.blank? || seed.to_s == "-1"

      normalized = seed.to_s
      unless normalized.match?(/\A\d+\z/)
        raise UploadValidator::ValidationError, "Seed deve ser numerica"
      end

      value = normalized.to_i
      unless value.between?(0, MAX_SEED)
        raise UploadValidator::ValidationError, "Seed fora do intervalo permitido"
      end

      true
    end

    # ─────────────────────────── Payload normalization ──────────────────────

    def normalize_wavespeed_payload(body)
      data = body.is_a?(Hash) ? (body["data"] || body) : body
      data = {} unless data.is_a?(Hash)

      provider_id = data["id"] || body["id"]
      raw_status  = (data["status"] || body["status"] || "processing").to_s.downcase
      raw_error   = data["error"] || body["error"] || data["message"] || body["message"]

      outputs = extract_outputs(data)

      status = if raw_status == "completed" && outputs.any?
                 "completed"
               elsif %w[failed error].include?(raw_status) || raw_error.to_s.present?
                 "failed"
               elsif %w[queued created processing running submitted].include?(raw_status)
                 "processing"
               else
                 "processing"
               end

      { provider_id: provider_id, status: status, outputs: outputs, error: raw_error }
    end

    def extract_outputs(data)
      outputs = []
      if data["outputs"].is_a?(Array)
        outputs = data["outputs"].map { |o| o.is_a?(Hash) ? o["url"] : o }.compact
      elsif data["images"].is_a?(Array)
        outputs = data["images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
      elsif data["result_images"].is_a?(Array)
        outputs = data["result_images"].map { |img| img.is_a?(Hash) ? img["url"] : img }.compact
      elsif data.dig("result", "outputs").is_a?(Array)
        outputs = data["result"]["outputs"].map { |o| o.is_a?(Hash) ? o["url"] : o }.compact
      end
      outputs
    end

    # ─────────────────────────── Job resolution ─────────────────────────────

    def find_job(id_or_request_id)
      raw = id_or_request_id.to_s

      if raw.match?(/\A\d+\z/)
        job = current_user.generation_jobs.find_by(id: raw.to_i)
        return job if job
      end

      current_user.generation_jobs.find_by(provider_request_id: raw)
    end

    def terminal_status_response(job)
      job.status == "completed" || job.status == "failed"
    end

    # ─────────────────────────── Completion & failure ───────────────────────

    def complete_job!(job, outputs:)
      # Phase 1: mark job completed atomically (always persists even if history fails)
      job.with_lock do
        if job.status == "failed" || job.refunded_at.present?
          return { status: job.status, outputs: job.output_urls, credits: current_user.reload.credits }
        end

        if job.status == "completed" && job.output_urls.any? && (job.metadata || {})["generation_created"]
          return { status: "completed", outputs: job.output_urls, credits: current_user.reload.credits }
        end

        job.update!(
          status: "completed",
          output_urls: outputs,
          completed_at: Time.current
        )
      end

      # Only the first caller reaches past the lock. Others hit the early return.
      metadata = job.reload.metadata || {}

      # Phase 2: history — never break the UI if this fails
      unless metadata["generation_created"]
        begin
          outputs.each do |url|
            current_user.generations.find_or_create_by!(
              generation_job_id: job.id, url: url
            ) do |gen|
              gen.model_label = job.avatar_model&.name || job.provider_model
              gen.generation_type = job.generation_type
              gen.prompt = job.prompt
              gen.thumbnail_url = job.thumbnail_url
              gen.provider = job.provider
              gen.provider_model = job.provider_model
              gen.aspect_ratio = job.aspect_ratio
              gen.resolution = job.resolution
              gen.duration = job.duration
            end
          end
          metadata["generation_created"] = true
        rescue => e
          Rails.logger.error("[GenerateStatus] generation_history_error job=#{job.id} #{e.class}: #{e.message}")
          metadata["history_error"] = "#{e.class}: #{e.message[0..200]}"
        end
      end

      # Phase 3: user counters — idempotent via metadata flag
      unless metadata["counters_updated"]
        begin
          column = job.generation_type == "image" ? :images_generated : :videos_generated
          current_user.increment!(column, outputs.size)
          metadata["counters_updated"] = true
        rescue => e
          Rails.logger.error("[GenerateStatus] counters_error job=#{job.id} #{e.class}: #{e.message}")
        end
      end

      # Phase 4: avatar model counter — only for image generations
      if job.avatar_model.present? && job.generation_type == "image" && !metadata["avatar_model_counter_updated"]
        begin
          job.avatar_model.increment!(:images_generated, outputs.size)
          metadata["avatar_model_counter_updated"] = true
        rescue => e
          Rails.logger.error("[GenerateStatus] avatar_counter_error job=#{job.id} #{e.class}: #{e.message}")
        end
      end

      # Phase 5: persist metadata
      job.update!(metadata: metadata)

      gen_count = metadata["generation_created"] ? outputs.size : 0
      Rails.logger.info("[GenerateStatus] completed job=#{job.id} generations=#{gen_count}")

      { status: "completed", outputs: job.output_urls, credits: current_user.reload.credits }
    end

    def fail_job!(job, error_message)
      job.with_lock do
        if job.status == "completed"
          return { status: "completed", outputs: job.output_urls, credits: current_user.reload.credits }
        end

        job.update!(status: "failed", error_message: error_message)

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
      end

      { status: "failed", error: error_message, outputs: job.output_urls, credits: current_user.reload.credits }
    end

    def refund_job(job)
      job.with_lock do
        return if job.status == "completed" || job.refunded_at

        job.update!(status: "failed", error_message: "Submit failed")
        CreditLedger.refund!(
          user: current_user,
          amount: job.cost_credits,
          source: job.source_for_refund,
          idempotency_key: "generation_job:#{job.id}:refund",
          reference: job,
          metadata: { error: "submit_failed" }
        )
        job.update!(refunded_at: Time.current)
      end
    rescue => e
      Rails.logger.error("[Generate] Erro ao reembolsar job #{job.id}: #{e.message}")
    end

    def ensure_generation_history!(job)
      return unless job.output_urls.present?

      created_count = 0
      job.output_urls.each do |url|
        current_user.generations.find_or_create_by!(generation_job_id: job.id, url: url) do |gen|
          gen.generation_type = job.generation_type
          gen.model_label = job.avatar_model&.name || job.provider_model.presence || "unknown"
          gen.prompt = job.prompt.presence || "Generated media"
          gen.provider = job.provider
          gen.provider_model = job.provider_model
          gen.thumbnail_url = job.thumbnail_url
          gen.aspect_ratio = job.aspect_ratio
          gen.resolution = job.resolution
          gen.duration = job.duration
          gen.seed = job.seed
        end
        created_count += 1
      end

      metadata = job.metadata || {}
      metadata["generation_created"] = true
      metadata.delete("history_error") if created_count.positive?
      job.update!(metadata: metadata)
    rescue => e
      Rails.logger.error("[GenerateStatus] generation_history_error job=#{job.id} #{e.class}: #{e.message}")
      m = job.metadata || {}
      m["history_error"] = "#{e.class}: #{e.message}".truncate(240)
      job.update!(metadata: m)
    end

    def mark_processing!(job)
      return unless job
      return if terminal_status_response(job)

      metadata = job.metadata || {}
      metadata["last_provider_status_code"] = nil unless metadata.key?("last_provider_status_code")
      metadata["last_provider_error_at"] = Time.current.iso8601
      job.update!(status: "processing", metadata: metadata) unless job.status == "processing"
    rescue => e
      Rails.logger.error("[Generate] Erro ao marcar processing job #{job.id}: #{e.message}")
    end

    # ─────────────────────────── Response payloads ──────────────────────────

    def status_payload(job)
      {
        status: job.status,
        outputs: job.output_urls,
        error: job.error_message,
        credits: current_user.reload.credits
      }
    end

    def processing_payload(job)
      {
        status: "processing",
        outputs: job&.output_urls || [],
        credits: current_user&.reload&.credits
      }
    end

    def internal_error_response(job, exception)
      Rails.logger.error("[Generate] Erro interno #{exception.class} job=#{job&.id}: #{exception.message[0..200]}")
      Rails.logger.error(exception.backtrace&.first(5)&.join("\n"))

      render json: {
        error: "Erro interno ao processar resultado"
      }, status: :internal_server_error
    end

    # ─────────────────────────── HTTP helpers ───────────────────────────────

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
        "Servico de imagem temporariamente indisponivel: saldo do provedor insuficiente."
      else
        "Servico de geracao temporariamente indisponivel"
      end
    end

    def upload_images_to_r2(model, images)
      UploadValidator.validate_data_urls(images, context: :reference)
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
