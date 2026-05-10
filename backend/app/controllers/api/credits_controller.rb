module Api
  class CreditsController < ApplicationController
    MAX_CREDIT_ADD = 10_000

    def balance
      render json: { balance: current_user.credits }
    end

    def add
      verify_credits_secret!
      amount = params[:amount].to_i
      return render_error("Amount must be positive") unless amount > 0
      return render_error("Amount exceeds maximum") if amount > MAX_CREDIT_ADD

      current_user.increment!(:credits, amount)
      render json: { balance: current_user.reload.credits }
    end

    def spend
      amount = params[:amount].to_i
      return render_error("Amount must be positive") unless amount > 0

      updated = User.where(id: current_user.id)
                    .where("credits >= ?", amount)
                    .update_all(["credits = credits - ?", amount])

      if updated == 0
        return render_error("Insufficient credits")
      end

      render json: { balance: current_user.reload.credits }
    end

    private

    def verify_credits_secret!
      secret = ENV["CREDITS_SECRET"]
      return unless secret.present?
      provided = request.headers["X-Credits-Secret"]
      render_error("Forbidden", :forbidden) unless provided == secret
    end
  end
end
