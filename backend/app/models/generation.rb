class Generation < ApplicationRecord
  belongs_to :user
  belongs_to :generation_job, optional: true

  ALLOWED_TYPES = %w[image video].freeze
  ALLOWED_SCHEMES = %w[https http].freeze

  validates :model_name,       presence: true
  validates :generation_type,  inclusion: { in: ALLOWED_TYPES }
  validates :prompt,           presence: true
  validates :url,              presence: true
  validate  :url_scheme_safe

  def as_json(options = {})
    super(options.merge(except: %i[user_id]))
      .merge("type" => generation_type)
      .tap { |h| h.delete("generation_type") }
  end

  private

  def url_scheme_safe
    return unless url.present?
    uri = URI.parse(url)
    unless ALLOWED_SCHEMES.include?(uri.scheme)
      errors.add(:url, "has an invalid scheme")
    end
  rescue URI::InvalidURIError
    errors.add(:url, "is not a valid URL")
  end
end
