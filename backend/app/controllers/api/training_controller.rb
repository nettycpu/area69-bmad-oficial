require "aws-sdk-s3"

module Api
  class TrainingController < ApplicationController
    TRAINING_COST = Pricing::HIGGSFIELD_TRAINING

    # POST /api/training/soul_id
    def create
      name   = params[:name].to_s.strip
      images = Array(params[:images])

      return render_error("Nome é obrigatório") if name.blank?
      return render_error("Envie pelo menos 10 fotos") if images.size < 10
      return render_error("Máximo de 30 fotos") if images.size > 30

      # Upload imagens para R2 (antes de salvar — não persistir base64 no banco)
      input_urls = upload_images_to_r2(name, images)

      # Build model record (sem training_images base64)
      model = current_user.avatar_models.create!(
        name: name,
        style: "realistic",
        cover: input_urls.first,
        status: "training",
        training_images_count: images.size
      )

      job = current_user.generation_jobs.create!(
        provider: "higgsfield",
        provider_model: "higgsfield-ai/soul/character",
        generation_type: "training",
        status: "queued",
        cost_credits: TRAINING_COST,
        prompt: "Training: #{name}",
        input_urls: input_urls,
        avatar_model: model,
        idempotency_key: "training:avatar_model:#{model.id}:#{SecureRandom.uuid}"
      )

      # Cobrar
      CreditLedger.spend!(
        user: current_user,
        amount: TRAINING_COST,
        source: "higgsfield_training",
        idempotency_key: "training:avatar_model:#{model.id}:charge",
        reference: job
      )
      job.update!(charged_at: Time.current, status: "submitted")

      # Enviar para Higgsfield em background
      HiggsfieldTrainingJob.perform_later(model.id, job.id)

      render json: {
        model: model_json(model),
        job_id: job.id,
        credits: current_user.reload.credits
      }, status: :created
    rescue CreditLedger::InsufficientCredits
      render_error("Créditos insuficientes — você tem #{current_user.credits}", :payment_required)
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    # GET /api/training/:id/status
    def status
      model = current_user.avatar_models.find(params[:id])
      if model.higgsfield_request_id.present? && model.status == "training"
        poll_higgsfield_status(model)
      end
      render json: {
        model: model_json(model),
        credits: current_user.reload.credits
      }
    rescue ActiveRecord::RecordNotFound
      render_error("Modelo não encontrado", :not_found)
    end

    private

    def poll_higgsfield_status(model)
      lookup_id = model.higgsfield_request_id || model.soul_id
      return unless lookup_id.present?

      job = model.user.generation_jobs.find_by(avatar_model: model, generation_type: "training", status: %w[submitted processing])

      begin
        result = HiggsfieldService.new.training_status(lookup_id)
        reference_id = result[:reference_id]

        case result[:status]
        when "completed"
          updates = { status: "ready" }
          updates[:soul_id] = reference_id.to_s if reference_id.present?
          updates[:higgsfield_request_id] = result[:request_id] if result[:request_id].present?
          model.update!(updates)
          job&.update!(status: "completed", completed_at: Time.current)
        when "training"
          updates = {}
          updates[:soul_id] = reference_id.to_s if reference_id.present? && model.soul_id.blank?
          updates[:higgsfield_request_id] = result[:request_id] if result[:request_id].present? && model.higgsfield_request_id.blank?
          model.update!(updates) unless updates.empty?
          job&.update!(status: "processing")
        when "failed"
          model.update!(status: "failed")
          refund_training(model, job, result[:error] || "Provider returned failed status")
        end
      rescue => e
        Rails.logger.error("[Higgsfield] Poll error: #{e.class} — #{e.message}")
        # Erro transitório — não marcar failed
        was_already_failed = model.status == "failed"
        unless was_already_failed
          Rails.logger.warn("[Higgsfield] Erro transitório no poll, mantendo training: #{e.message}")
        end
      end
    end

    def refund_training(model, job, error_message = nil)
      return if job&.refunded_at

      CreditLedger.refund!(
        user: model.user,
        amount: TRAINING_COST,
        source: "higgsfield_training",
        idempotency_key: "training:avatar_model:#{model.id}:refund",
        reference: job,
        metadata: { model_id: model.id, error: error_message }
      )
      job&.update!(status: "failed", error_message: error_message, refunded_at: Time.current)
    rescue => e
      Rails.logger.error("[Training] Erro ao reembolsar: #{e.message}")
    end

    def upload_images_to_r2(label, image_data_urls)
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

      image_data_urls.each do |data_url|
        mime = data_url[/^data:([^;]+);/, 1] || "image/png"
        raw  = data_url.split(",", 2).second || data_url
        decoded = Base64.decode64(raw)
        ext = mime_to_ext[mime] || "jpg"
        key = "training/#{label.parameterize}/#{SecureRandom.uuid}.#{ext}"
        bucket.object(key).put(body: decoded, content_type: mime)
        keys << key
      end

      keys.map { |key| "#{public_host}/#{key}" }
    end

    def model_json(model)
      {
        id: model.id,
        name: model.name,
        cover: model.cover,
        status: model.status,
        style: model.style,
        soul_id: model.soul_id,
        higgsfield_request_id: model.higgsfield_request_id,
        training_images_count: model.training_images_count,
        images_generated: model.images_generated,
        videos_generated: model.videos_generated,
        created_at: model.created_at
      }
    end
  end
end
