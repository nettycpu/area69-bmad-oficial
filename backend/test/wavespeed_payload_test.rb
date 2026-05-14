require "test_helper"

class WavespeedPayloadTest < ActiveSupport::TestCase
  test "normalizes completed wrapper payload with data outputs" do
    payload = {
      "code" => 200,
      "message" => "success",
      "data" => {
        "id" => "prediction-123",
        "status" => "completed",
        "outputs" => ["https://cdn.area69.test/result.png"],
        "error" => ""
      }
    }

    normalized = WavespeedPayload.normalize(payload)

    assert_equal "prediction-123", normalized[:provider_id]
    assert_equal "completed", normalized[:status]
    assert_equal ["https://cdn.area69.test/result.png"], normalized[:outputs]
    assert normalized[:error].blank?
  end

  test "does not treat provider success wrapper message as failure" do
    payload = {
      "message" => "success",
      "data" => {
        "id" => "prediction-456",
        "status" => "processing"
      }
    }

    normalized = WavespeedPayload.normalize(payload)

    assert_equal "processing", normalized[:status]
    assert normalized[:error].blank?
  end

  test "extracts output urls from common provider shapes" do
    payload = {
      "data" => {
        "result" => {
          "outputs" => [
            { "url" => "https://cdn.area69.test/a.png" },
            { "image" => { "url" => "https://cdn.area69.test/b.png" } }
          ]
        }
      }
    }

    assert_equal [
      "https://cdn.area69.test/a.png",
      "https://cdn.area69.test/b.png"
    ], WavespeedPayload.extract_outputs(payload)
  end
end
