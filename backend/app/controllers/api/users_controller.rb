module Api
  class UsersController < ApplicationController
    def show
      render json: { user: current_user.as_json }
    end

    def update
      if current_user.update(user_params)
        render json: { user: current_user.as_json }
      else
        render_error(current_user.errors.full_messages.join(", "))
      end
    end

    def change_password
      unless current_user.authenticate(password_params[:current_password])
        return render_error("Current password is incorrect", :unauthorized)
      end

      if current_user.update(
        password: password_params[:new_password],
        password_confirmation: password_params[:new_password]
      )
        render json: { message: "Password updated" }
      else
        render_error(current_user.errors.full_messages.join(", "))
      end
    end

    private

    def user_params
      params.permit(:name, :email, :avatar, :language, :notify_generations, :notify_promotions)
    end

    def password_params
      params.permit(:current_password, :new_password)
    end
  end
end
