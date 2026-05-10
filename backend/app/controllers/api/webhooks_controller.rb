module Api
  class WebhooksController < ApplicationController
    skip_before_action :authenticate_request, only: [:stripe]

    # POST /api/webhooks/stripe
    def stripe
      payload    = request.body.read
      sig_header = request.headers["Stripe-Signature"]
      secret     = ENV.fetch("STRIPE_WEBHOOK_SECRET", "")

      if secret.blank?
        Rails.logger.error("[StripeWebhook] STRIPE_WEBHOOK_SECRET nao configurado")
        head :internal_server_error and return
      end

      event = Stripe::Webhook.construct_event(payload, sig_header, secret)

      case event.type
      when "checkout.session.completed"
        session = event.data.object
        result  = StripeService.new.handle_checkout_completed(session)
        Rails.logger.info("[StripeWebhook] Processado: #{result}")

      when "checkout.session.expired"
        session = event.data.object
        user = User.find_by(stripe_checkout_session_id: session.id)
        user&.update!(stripe_checkout_session_id: nil) if user
        Rails.logger.info("[StripeWebhook] Sessao expirada limpa: #{session.id}")

      else
        Rails.logger.info("[StripeWebhook] Evento ignorado: #{event.type}")
      end

      head :ok
    rescue JSON::ParserError
      head :bad_request
    rescue Stripe::SignatureVerificationError => e
      Rails.logger.error("[StripeWebhook] Assinatura invalida: #{e.message}")
      head :unauthorized
    rescue StripeService::Error => e
      Rails.logger.error("[StripeWebhook] Erro de negocio: #{e.message}")
      head :unprocessable_entity
    rescue => e
      Rails.logger.error("[StripeWebhook] Erro inesperado: #{e.message}")
      head :internal_server_error
    end
  end
end
