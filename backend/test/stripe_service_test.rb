require "test_helper"
require "ostruct"

class StripeServiceTest < ActiveSupport::TestCase
  test "checkout completion adds selected credits and remains idempotent" do
    user = User.create!(
      name: "Stripe Credit Tester",
      email: "stripe-credit-#{SecureRandom.hex(8)}@area69.test",
      password: "password123",
      password_confirmation: "password123",
      credits: 100
    )

    purchase_300 = create_purchase(user, "cs_test_300", 300)
    session_300 = checkout_session(purchase_300, payment_intent: "pi_300", amount_total: 13_900)

    result_300 = StripeService.new.handle_checkout_completed(session_300)

    assert_equal 300, result_300[:credits_added]
    assert_equal 400, user.reload.credits
    assert_equal "paid", purchase_300.reload.status

    purchase_50 = create_purchase(user, "cs_test_50", 50)
    session_50 = checkout_session(purchase_50, payment_intent: "pi_50", amount_total: 2_900)

    result_50 = StripeService.new.handle_checkout_completed(session_50)

    assert_equal 50, result_50[:credits_added]
    assert_equal 450, user.reload.credits
    assert_equal "paid", purchase_50.reload.status

    duplicate = StripeService.new.handle_checkout_completed(session_50)

    assert duplicate[:duplicate]
    assert_equal 0, duplicate[:credits_added]
    assert_equal 450, user.reload.credits
    assert_equal 350, user.credit_transactions.posted.sum(:amount)
  end

  test "checkout completion requires an existing local purchase" do
    user = User.create!(
      name: "Stripe Metadata Tester",
      email: "stripe-metadata-#{SecureRandom.hex(8)}@area69.test",
      password: "password123",
      password_confirmation: "password123",
      credits: 100
    )
    session = OpenStruct.new(
      id: "cs_orphaned",
      payment_status: "paid",
      payment_intent: "pi_orphaned",
      amount_total: 13_900,
      currency: "brl",
      metadata: {
        "user_id" => user.id.to_s,
        "credits" => "300"
      }
    )

    error = assert_raises(StripeService::Error) do
      StripeService.new.handle_checkout_completed(session)
    end

    assert_match "Compra nao encontrada", error.message
    assert_equal 100, user.reload.credits
    assert_equal 0, user.credit_transactions.count
    assert_equal 0, CreditPurchase.where(stripe_checkout_session_id: "cs_orphaned").count
  end

  private

  def create_purchase(user, session_id, credits)
    CreditPurchase.create!(
      user: user,
      stripe_checkout_session_id: session_id,
      credits: credits,
      status: "pending"
    )
  end

  def checkout_session(purchase, payment_intent:, amount_total:)
    OpenStruct.new(
      id: purchase.stripe_checkout_session_id,
      payment_status: "paid",
      payment_intent: payment_intent,
      amount_total: amount_total,
      currency: "brl",
      metadata: {
        "user_id" => purchase.user_id.to_s,
        "credits" => purchase.credits.to_s
      }
    )
  end
end
