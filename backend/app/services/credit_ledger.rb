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
        return { transaction: existing, balance: existing.balance_after, duplicate: true }
      end

      user.lock!

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
        return { transaction: existing, balance: existing.balance_after, duplicate: true }
      end

      user.lock!

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
        return { transaction: existing, balance: existing.balance_after, duplicate: true }
      end

      user.lock!

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
end
