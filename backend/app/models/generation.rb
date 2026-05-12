class Generation < ApplicationRecord
  self.inheritance_column = nil

  belongs_to :user
  belongs_to :generation_job, optional: true

  ALLOWED_TYPES = %w[image video].freeze
  ALLOWED_SCHEMES = %w[https http].freeze

  validates :model_label,     presence: true
  validates :generation_type,  inclusion: { in: ALLOWED_TYPES }
  validates :prompt,           presence: true
  validates :url,              presence: true
  validate  :url_scheme_safe

  def as_json(options = {})
    data = super(options.merge(except: %i[user_id]))
    data["type"] = generation_type
    data["model_name"]  = model_label
    data["modelName"]   = model_label
    data.delete("generation_type")
    data
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
