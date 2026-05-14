class CreditLedger
  class Error < StandardError; end
  class InsufficientCredits < Error; end
  class DuplicateTransaction < Error; end

  # Adiciona créditos (compra, bônus, admin_adjustment)
  def self.add!(user:, amount:, kind:, source:, idempotency_key:, reference: nil, metadata: {})
    raise Error, "amount deve ser positivo" unless amount.is_a?(Integer) && amount > 0

    ActiveRecord::Base.transaction do
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      if existing
        return duplicate_result!(existing, user)
      end

      user.lock!
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      return duplicate_result!(existing, user) if existing

      balance_before = user.credits
      balance_after  = balance_before + amount

      tx = CreditTransaction.create!(
        user: user,
        amount: amount,
        balance_before: balance_before,
        balance_after: balance_after,
        kind: kind,
        source: source,
        idempotency_key: idempotency_key,
        reference: reference,
        metadata: metadata
      )

      user.update!(credits: balance_after)

      { transaction: tx, balance: balance_after, duplicate: false }
    end
  end

  # Gasta créditos (geração, treino)
  def self.spend!(user:, amount:, source:, idempotency_key:, reference: nil, metadata: {})
    raise Error, "amount deve ser positivo" unless amount.is_a?(Integer) && amount > 0

    ActiveRecord::Base.transaction do
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      if existing
        return duplicate_result!(existing, user)
      end

      user.lock!
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      return duplicate_result!(existing, user) if existing

      if user.credits < amount
        raise InsufficientCredits, "Creditos insuficientes: tem #{user.credits}, precisa #{amount}"
      end

      balance_before = user.credits
      balance_after  = balance_before - amount

      tx = CreditTransaction.create!(
        user: user,
        amount: -amount,
        balance_before: balance_before,
        balance_after: balance_after,
        kind: "spend",
        source: source,
        idempotency_key: idempotency_key,
        reference: reference,
        metadata: metadata
      )

      user.update!(credits: balance_after)

      { transaction: tx, balance: balance_after, duplicate: false }
    end
  end

  # Reembolsa créditos (falha de provedor, cancelamento)
  def self.refund!(user:, amount:, source:, idempotency_key:, reference: nil, metadata: {})
    raise Error, "amount deve ser positivo" unless amount.is_a?(Integer) && amount > 0

    ActiveRecord::Base.transaction do
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      if existing
        return duplicate_result!(existing, user)
      end

      user.lock!
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      return duplicate_result!(existing, user) if existing

      balance_before = user.credits
      balance_after  = balance_before + amount

      tx = CreditTransaction.create!(
        user: user,
        amount: amount,
        balance_before: balance_before,
        balance_after: balance_after,
        kind: "refund",
        source: source,
        idempotency_key: idempotency_key,
        reference: reference,
        metadata: metadata
      )

      user.update!(credits: balance_after)

      { transaction: tx, balance: balance_after, duplicate: false }
    end
  end

  def self.duplicate_result!(transaction, user)
    if transaction.user_id != user.id
      raise DuplicateTransaction, "idempotency_key ja usada por outro usuario"
    end

    { transaction: transaction, balance: user.reload.credits, duplicate: true }
  end
end
