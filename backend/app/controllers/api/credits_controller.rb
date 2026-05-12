module Api
  class CreditsController < ApplicationController
    MAX_CREDIT_ADD = 10_000

    def balance
      render json: {
        balance: current_user.credits,
        ledger_latest: current_user.credit_transactions.posted.order(created_at: :desc).first&.as_json
      }
    end

    def add
      return unless verify_credits_secret!
      amount = params[:amount].to_i
      return render_error("Amount must be positive") unless amount > 0
      return render_error("Amount exceeds maximum") if amount > MAX_CREDIT_ADD

      idempotency_key = request.headers["X-Idempotency-Key"].presence || "admin:add:#{current_user.id}:#{SecureRandom.uuid}"

      result = CreditLedger.add!(
        user: current_user,
        amount: amount,
        kind: "admin_adjustment",
        source: "admin",
        idempotency_key: idempotency_key,
        metadata: { note: params[:note] }
      )

      render json: { balance: result[:balance] }
    rescue CreditLedger::Error => e
      render_error(e.message)
    end

    def spend
      return unless verify_credits_secret!
      amount = params[:amount].to_i
      return render_error("Amount must be positive") unless amount > 0

      idempotency_key = request.headers["X-Idempotency-Key"].presence || "admin:spend:#{current_user.id}:#{SecureRandom.uuid}"

      result = CreditLedger.spend!(
        user: current_user,
        amount: amount,
        source: "admin",
        idempotency_key: idempotency_key,
        metadata: { note: params[:note] }
      )

      render json: { balance: result[:balance] }
    rescue CreditLedger::InsufficientCredits => e
      render_error(e.message, :payment_required)
    rescue CreditLedger::Error => e
      render_error(e.message)
    end

    def pricing
      render json: Pricing.all
    end

    private

    def verify_credits_secret!
      secret = ENV["CREDITS_SECRET"]

      if secret.blank?
        if Rails.env.production?
          Rails.logger.error("[CREDITS] CREDITS_SECRET nao configurado em production!")
          render_error("Credit admin endpoint not configured", :service_unavailable)
          return false
        else
          # Development/test: permite sem secret para facilitar debug
          return true
        end
      end

      provided = request.headers["X-Credits-Secret"]
      unless provided == secret
        render_error("Forbidden", :forbidden)
        return false
      end

      true
    end
  end
end
