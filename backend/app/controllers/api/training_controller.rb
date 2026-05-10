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
      service = HiggsfieldService.new
      result  = service.train_soul(name: model.name, image_urls: images)

      Rails.logger.info("[Higgsfield] Submitted OK — request_id=#{result[:request_id]}")
      if result[:request_id].present?
        model.update!(
          higgsfield_request_id: result[:request_id],
          cover: images.first
        )
      end
    rescue => e
      status_code = e.respond_to?(:status_code) ? e.status_code : "N/A"
      clean_error = e.message.to_s.gsub(/base64,[^"\\]+/, 'base64,[REMOVED]')
      Rails.logger.error("HIGGSFIELD API ERROR: #{e.class} — status=#{status_code} — #{clean_error[0..1000]}")
      Rails.logger.error(e.backtrace&.first(10)&.join("\n")) if e.backtrace
      model.update!(status: "failed")
      model.user&.increment!(:credits, TRAINING_COST)
    end

    def poll_higgsfield_status(model)
      result = HiggsfieldService.new.training_status(model.higgsfield_request_id)
      reference_id = result[:reference_id]

      case result[:status]
      when "completed"
        if reference_id.present?
          model.update!(
            status: "ready",
            soul_id: reference_id.to_s
          )
        else
          Rails.logger.error("[Higgsfield] Falha critica: API retornou completed sem reference_id. Resposta: #{result[:raw_body].inspect}")
          model.update!(status: "failed")
          model.user&.increment!(:credits, TRAINING_COST)
        end
      when "failed", "nsfw"
        model.update!(status: "failed")
        model.user&.increment!(:credits, TRAINING_COST)
      end
    rescue => e
      Rails.logger.error("[Higgsfield] Poll error: #{e.class} — #{e.message}")
      model.update!(status: "failed")
      model.user&.increment!(:credits, TRAINING_COST)
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
