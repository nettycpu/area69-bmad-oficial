module Api
  class GenerationsController < ApplicationController
    VALID_TYPES = %w[image video].freeze

    def index
      generations = current_user.generations
                                 .order(created_at: :desc)
                                 .limit(200)
      render json: { generations: generations.as_json }
    end

    def create
      gen_type = params[:type] || params[:generation_type]
      unless VALID_TYPES.include?(gen_type)
        return render_error("type must be 'image' or 'video'")
      end

      generation = current_user.generations.build(generation_params)
      generation.generation_type = gen_type

      if generation.save
        update_generation_counts(gen_type)
        render json: { generation: generation.as_json }, status: :created
      else
        render_error(generation.errors.full_messages.join(", "))
      end
    end

    def destroy
      gen = current_user.generations.find(params[:id])
      gen.destroy
      head :no_content
    rescue ActiveRecord::RecordNotFound
      render_error("Generation not found", :not_found)
    end

    private

    def generation_params
      params.permit(:model_name, :prompt, :url, :seed, :width, :height)
    end

    def update_generation_counts(gen_type)
      column = gen_type == "image" ? :images_generated : :videos_generated
      current_user.increment!(column)
    end
  end
end
