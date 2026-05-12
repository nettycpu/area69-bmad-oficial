require "aws-sdk-s3"

module Api
  class TrainingController < ApplicationController
    TRAINING_COST = 150

    # POST /api/training/soul_id
    # Body: { name: string, images: [base64_data_url, ...] }
    def create
      name   = params[:name].to_s.strip
      images = Array(params[:images])

      return render_error("Nome é obrigatório") if name.blank?
      return render_error("Envie pelo menos 10 fotos") if images.size < 10
      return render_error("Máximo de 30 fotos") if images.size > 30

      # Deduct credits first
      updated = User.where(id: current_user.id)
                    .where("credits >= ?", TRAINING_COST)
                    .update_all(["credits = credits - ?", TRAINING_COST])
      return render_error("Créditos insuficientes — você tem #{current_user.credits}", :payment_required) if updated == 0

      # Build model record — don't store raw base64 in cover, use nil (no preview until ready)
      model = current_user.avatar_models.create!(
        name: name,
        style: "realistic",
        cover: nil,
        status: "training",
        training_images_count: images.size
      )

      # Submit to Higgsfield in background thread so response is fast
      Thread.new do
        submit_to_higgsfield(model, images)
      end

      render json: {
        model: model_json(model),
        credits: current_user.reload.credits
      }, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render_error(e.message)
    end

    # GET /api/training/:id/status
    def status
      model = current_user.avatar_models.find(params[:id])
      poll_higgsfield_status(model) if model.higgsfield_request_id.present? && model.status == "training"
      render json: { model: model_json(model) }
    rescue ActiveRecord::RecordNotFound
      render_error("Modelo não encontrado", :not_found)
    end

    private

    def submit_to_higgsfield(model, images)
      # images sao data URLs completas ex: "data:image/png;base64,iVBOR..."
      public_urls = upload_images_to_r2(model, images)

      # Salvar cover imediatamente apos upload, antes mesmo do treino
      model.update!(cover: public_urls.first) if public_urls.first.present?

      service = HiggsfieldService.new
      result  = service.train_soul(name: model.name, image_urls: public_urls)

      request_id   = result[:request_id]
      reference_id = result[:reference_id]
      result_status = result[:status]

      Rails.logger.info("[Higgsfield] Submitted OK — request_id=#{request_id} reference_id=#{reference_id} status=#{result_status}")

      updates = {}
      updates[:higgsfield_request_id] = request_id if request_id.present?
      updates[:soul_id] = reference_id if reference_id.present?
      if result_status == "completed" || result_status == "ready"
        updates[:status] = "ready"
      end
      model.update!(updates) unless updates.empty?
    rescue => e
      status_code = e.respond_to?(:status_code) ? e.status_code : "N/A"
      clean_error = e.message.to_s.gsub(/https:\/\/[^\s,]+/, '[URL_REMOVED]')
      Rails.logger.error("HIGGSFIELD API ERROR: #{e.class} — status=#{status_code} — #{clean_error[0..1000]}")
      Rails.logger.error(e.backtrace&.first(10)&.join("\n")) if e.backtrace
      model.update!(status: "failed")
      model.user&.increment!(:credits, TRAINING_COST)
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

        key = "training/#{model.id}/#{SecureRandom.uuid}.#{ext}"

        bucket.object(key).put(
          body: decoded,
          content_type: mime
        )

        keys << key
      end

      keys.map { |key| "#{public_host}/#{key}" }
    end

    def poll_higgsfield_status(model)
      lookup_id = model.higgsfield_request_id || model.soul_id
      return unless lookup_id.present?

      result = HiggsfieldService.new.training_status(lookup_id)
      reference_id = result[:reference_id]

      case result[:status]
      when "completed"
        updates = { status: "ready" }
        updates[:soul_id] = reference_id.to_s if reference_id.present?
        updates[:higgsfield_request_id] = result[:request_id] if result[:request_id].present?
        model.update!(updates)
      when "training"
        # Ainda treinando — apenas atualiza soul_id se veio na resposta
        updates = {}
        updates[:soul_id] = reference_id.to_s if reference_id.present? && model.soul_id.blank?
        updates[:higgsfield_request_id] = result[:request_id] if result[:request_id].present? && model.higgsfield_request_id.blank?
        model.update!(updates) unless updates.empty?
      when "failed"
        # Evitar reembolso duplicado — so reembolsar se nao estava ja como failed
        was_already_failed = model.status == "failed"
        model.update!(status: "failed")
        unless was_already_failed
          model.user&.increment!(:credits, TRAINING_COST)
        end
      end
    rescue => e
      Rails.logger.error("[Higgsfield] Poll error: #{e.class} — #{e.message}")
      was_already_failed = model.status == "failed"
      model.update!(status: "failed")
      unless was_already_failed
        model.user&.increment!(:credits, TRAINING_COST)
      end
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
