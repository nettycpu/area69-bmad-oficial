class CreditTransaction < ApplicationRecord
  belongs_to :user
  belongs_to :reference, polymorphic: true, optional: true

  validates :amount, presence: true, numericality: { other_than: 0 }
  validates :balance_before, presence: true
  validates :balance_after, presence: true
  validates :kind, presence: true, inclusion: { in: %w[purchase spend refund admin_adjustment signup_bonus] }
  validates :source, presence: true, inclusion: { in: %w[stripe qwen_image seedance_video higgsfield_character higgsfield_training admin system] }
  validates :idempotency_key, presence: true, uniqueness: true
  validate :amount_direction_matches_kind

  scope :posted, -> { where(status: "posted") }
  scope :by_user, ->(user_id) { where(user_id: user_id).order(created_at: :desc) }

  private

  def amount_direction_matches_kind
    return if amount.blank? || kind.blank?

    if kind == "spend" && amount >= 0
      errors.add(:amount, "must be negative for spend transactions")
    elsif kind != "spend" && amount <= 0
      errors.add(:amount, "must be positive for credit transactions")
    end
  end
end
