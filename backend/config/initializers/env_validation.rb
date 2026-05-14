# frozen_string_literal: true

if Rails.env.production?
  required_vars = %w[
    SECRET_KEY_BASE
    JWT_SECRET
    DATABASE_URL
    FRONTEND_BASE_URL
    ALLOWED_ORIGINS
    STRIPE_API_KEY
    STRIPE_WEBHOOK_SECRET
    STRIPE_PRICE_50_CREDITS
    STRIPE_PRICE_150_CREDITS
    STRIPE_PRICE_300_CREDITS
    STRIPE_PRICE_600_CREDITS
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
    raise "[ENV] Variaveis de ambiente obrigatorias ausentes em production: #{missing.join(', ')}"
  end
end
