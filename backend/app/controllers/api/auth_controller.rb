module Api
  class AuthController < ApplicationController
    skip_before_action :authenticate_request

    def register
      normalized = register_params
      normalized[:email] = normalized[:email]&.downcase&.strip

      if normalized[:password].to_s.length < 8
        return render_error("A senha deve ter no minimo 8 caracteres")
      end

      user = User.new(normalized)

      unless user.save
        return render_error(user.errors.full_messages.join(", "))
      end

      render json: build_auth_response(user), status: :created
    end

    def login
      email = login_params[:email]&.downcase&.strip
      user  = User.find_by(email: email)

      unless user&.authenticate(login_params[:password])
        return render_error("Email ou senha invalidos", :unauthorized)
      end

      render json: build_auth_response(user)
    end

    private

    def register_params
      params.permit(:name, :email, :password, :password_confirmation)
    end

    def login_params
      params.permit(:email, :password)
    end

    def build_auth_response(user)
      {
        token: encode_jwt(user.id),
        user:  user.as_json
      }
    end

    def encode_jwt(user_id)
      payload = {
        user_id: user_id,
        exp:     30.days.from_now.to_i
      }
      JWT.encode(payload, jwt_secret, "HS256")
    end
  end
end
