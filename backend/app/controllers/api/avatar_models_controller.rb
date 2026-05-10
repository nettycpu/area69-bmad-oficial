module Api
  class AvatarModelsController < ApplicationController
    before_action :set_model, only: [:update, :destroy]

    def index
      models = current_user.avatar_models.order(created_at: :desc)
      render json: { models: models.as_json }
    end

    def create
      model = current_user.avatar_models.build(model_params)
      if model.save
        render json: { model: model.as_json }, status: :created
      else
        render_error(model.errors.full_messages.join(", "))
      end
    end

    def update
      if @model.update(update_params)
        render json: { model: @model.as_json }
      else
        render_error(@model.errors.full_messages.join(", "))
      end
    end

    def destroy
      @model.destroy
      head :no_content
    end

    private

    def set_model
      @model = current_user.avatar_models.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Model not found", :not_found)
    end

    def model_params
      params.require(:avatar_model).permit(:name, :style, :cover, :description, :status, :soul_id)
    end

    def update_params
      params.require(:avatar_model).permit(:name, :status, :cover, :description, :images_generated, :videos_generated, :soul_id, :higgsfield_request_id, :request_id)
    end
  end
end
