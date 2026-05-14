# frozen_string_literal: true

class Rack::Attack
  # Auth
  throttle("auth/login/ip", limit: 5, period: 60) do |req|
    req.ip if req.path == "/api/auth/login" && req.post?
  end

  throttle("auth/register/ip", limit: 3, period: 60) do |req|
    req.ip if req.path == "/api/auth/register" && req.post?
  end

  # Generate endpoints
  throttle("generate/user", limit: 10, period: 60) do |req|
    req.env["jwt.user_id"] if req.path.start_with?("/api/generate/") && req.post?
  end

  # Training
  throttle("training/user", limit: 3, period: 3600) do |req|
    req.env["jwt.user_id"] if req.path.in?(["/api/training/character", "/api/training/soul_id"]) && req.post?
  end

  # Checkout
  throttle("checkout/user", limit: 10, period: 3600) do |req|
    req.env["jwt.user_id"] if req.path == "/api/checkout/stripe" && req.post?
  end

  self.throttled_responder = lambda { |req|
    headers = { "Retry-After" => "60" }
    [429, headers, [{ error: "Muitas requisicoes. Aguarde antes de tentar novamente." }.to_json]]
  }
end
