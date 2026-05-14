require "test_helper"

class GenerateParameterContractTest < ActiveSupport::TestCase
  test "image and video aspect ratios all have size mappings" do
    Api::GenerateController::ASPECT_RATIOS.each do |aspect|
      Api::GenerateController::RESOLUTIONS.each do |resolution|
        assert Api::GenerateController::SIZE_MAP.key?([aspect, resolution]),
          "missing size mapping for #{aspect} #{resolution}"
      end
    end
  end

  test "character studio keeps its own provider aspect ratios" do
    assert_includes Api::GenerateController::HIGGSFIELD_ASPECT_RATIOS, "4:5"
    assert_not_includes Api::GenerateController::ASPECT_RATIOS, "4:5"
  end

  test "image pricing is resolution based and keeps 480p locked" do
    assert_equal 1, Pricing::QWEN_IMAGE_BY_RESOLUTION.fetch("480p")
    assert_equal 5, Pricing::QWEN_IMAGE_BY_RESOLUTION.fetch("720p")
    assert_equal 15, Pricing::QWEN_IMAGE_BY_RESOLUTION.fetch("1080p")
    assert_includes Api::GenerateController::LOCKED_IMAGE_RESOLUTIONS, "480p"
  end
end
