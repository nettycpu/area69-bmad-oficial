class StripeService
  class Error < StandardError; end

  VALID_CREDIT_PACKS = [50, 150, 300, 600].freeze

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

    user.update!(stripe_checkout_session_id: session.id)

    { url: session.url, session_id: session.id }
  rescue Stripe::StripeError => e
    raise Error, "Stripe API error: #{e.message}"
  end

  # ── Processar Webhook checkout.session.completed ──────────────────────────

  def handle_checkout_completed(session)
    user_id = session.metadata["user_id"]
    credits = session.metadata["credits"].to_i

    raise Error, "Metadados invalidos na sessao — user_id ou credits ausentes" unless user_id.present? && credits > 0

    user = User.find(user_id)

    # Idempotencia: so processa se o session_id bater com o salvo no usuario
    unless user.stripe_checkout_session_id == session.id
      Rails.logger.warn("[Stripe] Sessao #{session.id} ja processada ou invalida para user #{user_id}")
      return { user_id: user.id, credits_added: 0, session_id: session.id, duplicate: true }
    end

    ActiveRecord::Base.transaction do
      user.increment!(:credits, credits)
      user.update!(stripe_checkout_session_id: nil)
    end

    Rails.logger.info("[Stripe] Creditos adicionados: user=#{user.id} +#{credits} session=#{session.id}")
    { user_id: user.id, credits_added: credits, session_id: session.id }
  rescue ActiveRecord::RecordNotFound
    raise Error, "Usuario nao encontrado para sessao: #{session.id}"
  end

  private

  # ── Find-or-Create Stripe Customer ─────────────────────────────────────────

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
