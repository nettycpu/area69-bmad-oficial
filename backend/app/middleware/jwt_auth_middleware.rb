class JwtAuthMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    jwt_secret = if Rails.env.production?
                   ENV["JWT_SECRET"]
                 else
                   ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }
                 end

    if jwt_secret.present?
      header = env["HTTP_AUTHORIZATION"]
      token  = header.to_s.split(" ").last

      if token.present?
        begin
          payload = JWT.decode(token, jwt_secret, true, algorithm: "HS256")[0]
          env["jwt.user_id"] = payload["user_id"]
        rescue JWT::DecodeError, JWT::ExpiredSignature
          # A auth controller before_action lida com tokens invalidos
        end
      end
    end

    @app.call(env)
  end
end
