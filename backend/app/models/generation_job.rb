class GenerationJob < ApplicationRecord
  belongs_to :user
  belongs_to :avatar_model, optional: true

  validates :provider, presence: true, inclusion: { in: %w[wavespeed higgsfield] }
  validates :generation_type, presence: true, inclusion: { in: %w[image video training] }
  validates :status, presence: true, inclusion: { in: %w[queued submitted processing completed failed canceled timed_out] }
  validates :cost_credits, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :idempotency_key, presence: true, uniqueness: true

  scope :pending, -> { where(status: %w[queued submitted processing]) }
  scope :by_user, ->(user_id) { where(user_id: user_id).order(created_at: :desc) }

  def source_for_refund
    case provider
    when "wavespeed"
      generation_type == "video" ? "seedance_video" : "qwen_image"
    when "higgsfield"
      generation_type == "training" ? "higgsfield_training" : "higgsfield_character"
    else
      provider
    end
  end
end
