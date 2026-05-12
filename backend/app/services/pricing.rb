class Pricing
  QWEN_IMAGE = 5
  SEEDANCE_VIDEO = 30
  HIGGSFIELD_CHARACTER = 5
  HIGGSFIELD_TRAINING = 150

  CREDIT_PACKS = [50, 150, 300, 600].freeze

  def self.all
    {
      qwen_image: QWEN_IMAGE,
      seedance_video: SEEDANCE_VIDEO,
      higgsfield_character: HIGGSFIELD_CHARACTER,
      higgsfield_training: HIGGSFIELD_TRAINING,
      credit_packs: CREDIT_PACKS
    }
  end
end
