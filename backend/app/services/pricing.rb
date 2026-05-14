class Pricing
  QWEN_IMAGE = 5
  QWEN_IMAGE_BY_RESOLUTION = {
    "480p" => 1,
    "720p" => 5,
    "1080p" => 15
  }.freeze
  QWEN_IMAGE_LOCKED_RESOLUTIONS = %w[480p].freeze
  SEEDANCE_VIDEO = 30
  HIGGSFIELD_CHARACTER = 5
  HIGGSFIELD_TRAINING = 150

  CREDIT_PACKS = [50, 150, 300, 600].freeze

  def self.all
    {
      qwen_image: QWEN_IMAGE,
      qwen_image_by_resolution: QWEN_IMAGE_BY_RESOLUTION,
      qwen_image_locked_resolutions: QWEN_IMAGE_LOCKED_RESOLUTIONS,
      seedance_video: SEEDANCE_VIDEO,
      higgsfield_character: HIGGSFIELD_CHARACTER,
      higgsfield_training: HIGGSFIELD_TRAINING,
      credit_packs: CREDIT_PACKS
    }
  end
end
