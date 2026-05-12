class CreditPurchase < ApplicationRecord
  belongs_to :user

  validates :stripe_checkout_session_id, presence: true, uniqueness: true
  validates :credits, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w[pending paid expired failed] }
end
