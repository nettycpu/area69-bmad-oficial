module Api
  class CheckoutController < ApplicationController
    VALID_CREDIT_PACKS = [50, 150, 300, 600].freeze

    # POST /api/checkout/stripe
    def create
      credits = Integer(params[:credits], exception: false)
      unless credits && VALID_CREDIT_PACKS.include?(credits)
        return render_error("Pacote invalido. Opcoes: #{VALID_CREDIT_PACKS.join(', ')}")
      end

      success_url = params[:success_url].presence || "#{frontend_base}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"
      cancel_url  = params[:cancel_url].presence  || "#{frontend_base}/dashboard/billing"

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

    # POST /api/checkout/stripe/confirm
    def confirm
      session_id = params[:session_id].to_s.strip
      return render_error("session_id obrigatorio") if session_id.blank?

      purchase = current_user.credit_purchases.find_by(stripe_checkout_session_id: session_id)
      return render_error("Compra nao encontrada", :not_found) unless purchase

      if purchase.status == "paid"
        return render json: {
          status: "paid",
          credits_added: 0,
          balance: current_user.reload.credits,
          duplicate: true
        }
      end

      session = Stripe::Checkout::Session.retrieve(session_id)
      unless session.payment_status == "paid"
        return render json: {
          status: purchase.status,
          payment_status: session.payment_status,
          balance: current_user.reload.credits
        }, status: :accepted
      end

      result = StripeService.new.handle_checkout_completed(session)
      render json: {
        status: "paid",
        credits_added: result[:credits_added],
        balance: current_user.reload.credits,
        duplicate: result[:duplicate] == true
      }
    rescue Stripe::StripeError => e
      render_error("Erro ao confirmar pagamento: #{e.message}", :bad_gateway)
    rescue StripeService::Error => e
      render_error("Erro ao confirmar compra: #{e.message}", :bad_gateway)
    end

    private

    def frontend_base
      ENV.fetch("FRONTEND_BASE_URL", "http://localhost:5173")
    end
  end
end
