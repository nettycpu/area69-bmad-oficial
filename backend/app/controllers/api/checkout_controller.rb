module Api
  class CheckoutController < ApplicationController
    VALID_CREDIT_PACKS = [50, 150, 300, 600].freeze

    # POST /api/checkout/stripe
    def create
      credits = Integer(params[:credits], exception: false)
      unless credits && VALID_CREDIT_PACKS.include?(credits)
        return render_error("Pacote invalido. Opcoes: #{VALID_CREDIT_PACKS.join(', ')}")
      end

      success_url = params[:success_url].presence || "#{frontend_base}/dashboard?checkout=success"
      cancel_url  = params[:cancel_url].presence  || "#{frontend_base}/dashboard/pricing"

      result = StripeService.new.create_checkout_session(
        user:        current_user,
        credits:     credits,
        success_url: success_url,
        cancel_url:  cancel_url,
      )

      render json: { url: result[:url] }
    rescue StripeService::Error => e
      render_error("Erro ao criar sessao de checkout: #{e.message}", :bad_gateway)
    end

    private

    def frontend_base
      ENV.fetch("FRONTEND_BASE_URL", "http://localhost:5173")
    end
  end
end
