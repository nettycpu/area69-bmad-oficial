require "test_helper"

class HiggsfieldServicePayloadTest < ActiveSupport::TestCase
  class PayloadSpyService < HiggsfieldService
    attr_reader :posted_payload

    def custom_reference(reference_id)
      {
        id: reference_id,
        status: "completed",
        name: "Provider Name",
        raw_body: {}
      }
    end

    private

    def post(_path, payload, read_timeout: 60)
      @posted_payload = payload
      [{ "request_id" => "request-123", "status" => "queued" }, 200]
    end
  end

  setup do
    @old_key = ENV["HIGGSFIELD_API_KEY"]
    @old_secret = ENV["HIGGSFIELD_API_SECRET"]
    ENV["HIGGSFIELD_API_KEY"] = "test-key"
    ENV["HIGGSFIELD_API_SECRET"] = "test-secret"
  end

  teardown do
    ENV["HIGGSFIELD_API_KEY"] = @old_key
    ENV["HIGGSFIELD_API_SECRET"] = @old_secret
  end

  test "generation payload includes selected model as custom reference" do
    service = PayloadSpyService.new

    service.generate_image(
      soul_id: "69e2e1cd-5094-49f1-907f-ca8c0adc5353",
      prompt: "studio portrait",
      aspect_ratio: "9:16",
      resolution: "720p",
      character_strength: 1,
      style_id: "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe",
      style_strength: 1,
      custom_reference_strength: 1,
      custom_reference_name: "Mel Maia",
      enhance_prompt: true
    )

    assert_equal "69e2e1cd-5094-49f1-907f-ca8c0adc5353", service.posted_payload[:custom_reference_id]
    assert_equal 1, service.posted_payload[:custom_reference_strength]
    assert_equal 1, service.posted_payload[:batch_size]
    assert_equal "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe", service.posted_payload[:style_id]
    assert_equal 1, service.posted_payload[:style_strength]
    assert_nil service.posted_payload[:custom_reference]
    assert_nil service.posted_payload[:custom_reference_id_object]
    assert_nil service.posted_payload[:result_images]
    assert_nil service.posted_payload[:image_reference]
    assert_nil service.posted_payload[:character_id]
  end

  test "generation payload sends optional reference image as image reference url" do
    service = PayloadSpyService.new
    image_url = "https://media.area69.test/reference.png"

    service.generate_image(
      soul_id: "69e2e1cd-5094-49f1-907f-ca8c0adc5353",
      prompt: "studio portrait",
      images: [image_url],
      custom_reference_name: "Mel Maia"
    )

    assert_equal image_url, service.posted_payload[:image_reference_url]
    assert_nil service.posted_payload[:image_reference]
  end
end
