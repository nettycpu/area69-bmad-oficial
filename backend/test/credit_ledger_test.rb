require "test_helper"

class CreditLedgerTest < ActiveSupport::TestCase
  test "new users start with zero credits" do
    user = build_user

    assert_equal 0, user.credits
  end

  test "duplicate transactions return current user balance" do
    user = build_user

    CreditLedger.add!(
      user: user,
      amount: 300,
      kind: "purchase",
      source: "stripe",
      idempotency_key: "test:purchase:#{user.id}:300"
    )
    CreditLedger.add!(
      user: user,
      amount: 50,
      kind: "purchase",
      source: "stripe",
      idempotency_key: "test:purchase:#{user.id}:50"
    )

    duplicate = CreditLedger.add!(
      user: user,
      amount: 300,
      kind: "purchase",
      source: "stripe",
      idempotency_key: "test:purchase:#{user.id}:300"
    )

    assert duplicate[:duplicate]
    assert_equal 350, duplicate[:balance]
    assert_equal 350, user.reload.credits
    assert_equal 350, user.credit_transactions.posted.sum(:amount)
  end

  test "transaction direction must match kind" do
    user = build_user

    tx = user.credit_transactions.build(
      amount: 10,
      balance_before: 10,
      balance_after: 0,
      kind: "spend",
      source: "qwen_image",
      idempotency_key: "test:bad-spend:#{user.id}"
    )

    assert_not tx.valid?
    assert_includes tx.errors[:amount], "must be negative for spend transactions"
  end

  private

  def build_user
    User.create!(
      name: "Credit Tester",
      email: "credit-#{SecureRandom.hex(8)}@area69.test",
      password: "password123",
      password_confirmation: "password123"
    )
  end
end
