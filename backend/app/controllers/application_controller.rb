class ApplicationController < ActionController::API
  before_action :authenticate_request

  private

  def authenticate_request
    header = request.headers["Authorization"]
    token  = header&.split(" ")&.last
    return render_unauthorized unless token

    begin
      payload = JWT.decode(token, jwt_secret, true, algorithm: "HS256")[0]
      @current_user = User.find(payload["user_id"])
    rescue JWT::DecodeError, JWT::ExpiredSignature, ActiveRecord::RecordNotFound
      render_unauthorized
    end
  end

  def current_user
    @current_user
  end

  def jwt_secret
    ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }
  end

  def render_unauthorized
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def render_error(message, status = :unprocessable_entity)
    render json: { error: message }, status: status
  end
end
