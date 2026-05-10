class AvatarModel < ApplicationRecord
  belongs_to :user

  validates :name,  presence: true, length: { maximum: 100 }
  validates :style, presence: true
  validates :status, inclusion: { in: %w[training ready failed] }

  # Higgsfield Soul ID fields
  # higgsfield_request_id — UUID returned when training is submitted
  # soul_id               — LoRA ID returned when training completes

  COVER_SIZE_LIMIT = 2_000_000

  validate :cover_size_within_limit

  def as_json(options = {})
    super(options.merge(except: %i[user_id]))
  end

  private

  def cover_size_within_limit
    return unless cover.present?
    errors.add(:cover, "is too large (max 2MB)") if cover.bytesize > COVER_SIZE_LIMIT
  end
end
