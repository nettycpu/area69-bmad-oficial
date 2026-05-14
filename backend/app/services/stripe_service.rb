class StripeService
  class Error < StandardError; end

  VALID_CREDIT_PACKS = Pricing::CREDIT_PACKS

  PRICE_MAP = {
    50  => ENV.fetch("STRIPE_PRICE_50_CREDITS", ""),
    150 => ENV.fetch("STRIPE_PRICE_150_CREDITS", ""),
    300 => ENV.fetch("STRIPE_PRICE_300_CREDITS", ""),
    600 => ENV.fetch("STRIPE_PRICE_600_CREDITS", ""),
  }.freeze

  # ── Criar Checkout Session ────────────────────────────────────────────────

  def create_checkout_session(user:, credits:, success_url:, cancel_url:)
    price_id = PRICE_MAP[Integer(credits)]
    raise Error, "Pacote de creditos invalido: #{credits}. Opcoes: #{VALID_CREDIT_PACKS.join(', ')}" unless price_id
    raise Error, "Stripe Price ID nao configurado para #{credits} creditos. Defina STRIPE_PRICE_#{credits}_CREDITS no .env" if price_id.blank?

    customer = find_or_create_customer(user)

    session = Stripe::Checkout::Session.create(
      customer: customer.id,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: "payment",
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: {
        user_id: user.id.to_s,
        credits: credits.to_s,
      },
      expires_at: (Time.now + 30 * 60).to_i,
    )

    # Criar CreditPurchase pending — fonte de verdade
    CreditPurchase.create!(
      user: user,
      stripe_checkout_session_id: session.id,
      credits: credits,
      status: "pending",
      metadata: { amount_total: session.amount_total, currency: session.currency }
    )

    # Cache no user para compatibilidade, mas nao como fonte unica
    user.update!(stripe_checkout_session_id: session.id)

    { url: session.url, session_id: session.id }
  rescue ActiveRecord::RecordInvalid => e
    raise Error, "Erro ao registrar compra: #{e.message}"
  rescue Stripe::StripeError => e
    raise Error, "Stripe API error: #{e.message}"
  end

  # ── Processar Webhook checkout.session.completed ──────────────────────────

  def handle_checkout_completed(session)
    unless session.payment_status == "paid"
      raise Error, "Sessao #{session.id} ainda nao esta paga (payment_status=#{session.payment_status})"
    end

    purchase = CreditPurchase.find_by(stripe_checkout_session_id: session.id)

    unless purchase
      # Fallback: tentar criar purchase a partir de metadados (webhook atrasado/recriado)
      user_id = session.metadata["user_id"]
      credits = session.metadata["credits"].to_i
      raise Error, "Pacote de creditos invalido na sessao: #{credits}" unless VALID_CREDIT_PACKS.include?(credits)
      raise Error, "Metadados invalidos — user_id ou credits ausentes" unless user_id.present? && credits > 0
      raise Error, "Compra ja processada (nao encontrada por session_id mas pode ser duplicata)" if CreditPurchase.exists?(stripe_checkout_session_id: session.id)

      user = User.find(user_id)
      purchase = CreditPurchase.create!(
        user: user,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        credits: credits,
        status: "pending",
        metadata: { amount_total: session.amount_total, currency: session.currency, recovered: true }
      )
    end

    # Idempotencia: se ja pago, nao somar de novo
    if purchase.status == "paid"
      Rails.logger.info("[Stripe] Purchase #{purchase.id} ja processada, ignorando duplicata")
      return { user_id: purchase.user_id, credits_added: 0, session_id: session.id, duplicate: true }
    end

    ActiveRecord::Base.transaction do
      purchase.lock!

      if purchase.status == "paid"
        return { user_id: purchase.user_id, credits_added: 0, session_id: session.id, duplicate: true }
      end

      CreditLedger.add!(
        user: purchase.user,
        amount: purchase.credits,
        kind: "purchase",
        source: "stripe",
        idempotency_key: "stripe:checkout_session_completed:#{session.id}",
        reference: purchase,
        metadata: {
          session_id: session.id,
          payment_intent: session.payment_intent,
          amount_total: session.amount_total,
          currency: session.currency
        }
      )

      purchase.update!(
        status: "paid",
        stripe_payment_intent_id: session.payment_intent,
        amount_total: session.amount_total,
        currency: session.currency
      )

      # Limpar cache no user
      purchase.user.update!(stripe_checkout_session_id: nil) if purchase.user.stripe_checkout_session_id == session.id
    end

    Rails.logger.info("[Stripe] Creditos adicionados: user=#{purchase.user.id} +#{purchase.credits} session=#{session.id}")
    { user_id: purchase.user.id, credits_added: purchase.credits, session_id: session.id }
  rescue ActiveRecord::RecordNotFound
    raise Error, "Usuario nao encontrado para sessao: #{session.id}"
  end

  private

  # ── Find-or-Create Stripe Customer ────────────────────────────────────────

  def find_or_create_customer(user)
    customer = if user.stripe_customer_id.present?
                 begin
                   Stripe::Customer.retrieve(user.stripe_customer_id)
                 rescue Stripe::InvalidRequestError
                   nil
                 end
               end

    return customer if customer

    customer = Stripe::Customer.create(
      email: user.email,
      name: user.name,
      metadata: { user_id: user.id.to_s },
    )
    user.update!(stripe_customer_id: customer.id)
    customer
  end
end
