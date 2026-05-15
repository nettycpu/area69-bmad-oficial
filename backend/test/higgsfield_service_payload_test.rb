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
      custom_reference_name: "Mel Maia",
      enhance_prompt: true
    )

    assert_equal(
      {
        id: "69e2e1cd-5094-49f1-907f-ca8c0adc5353",
        name: "Mel Maia"
      },
      service.posted_payload[:custom_reference]
    )
    assert_equal "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe", service.posted_payload[:style_id]
    assert_equal 1, service.posted_payload[:style_strength]
    assert_nil service.posted_payload[:character_id]
  end
end
