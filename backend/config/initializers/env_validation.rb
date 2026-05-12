# frozen_string_literal: true

if Rails.env.production?
  required_vars = %w[
    JWT_SECRET
    DATABASE_URL
    FRONTEND_BASE_URL
    STRIPE_API_KEY
    STRIPE_WEBHOOK_SECRET
    HIGGSFIELD_API_KEY
    HIGGSFIELD_API_SECRET
    WAVESPEED_API_KEY
    CREDITS_SECRET
    INTERNAL_SECRET
    R2_PUBLIC_URL_HOST
    R2_BUCKET
    R2_ENDPOINT
    R2_ACCESS_KEY_ID
    R2_SECRET_ACCESS_KEY
  ]

  missing = required_vars.select { |var| ENV[var].blank? }

  if missing.any?
    Rails.logger.error("[ENV] VARIAVEIS DE AMBIENTE OBRIGATORIAS AUSENTES: #{missing.join(', ')}")
    Rails.logger.error("[ENV] A aplicacao pode falhar em production sem estas variaveis.")
  end
end
