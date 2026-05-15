require "test_helper"

class GenerateHiggsfieldControllerTest < ActionDispatch::IntegrationTest
  class FakeHiggsfieldService
    attr_reader :soul_id, :prompt, :options

    def generate_image(soul_id:, prompt:, **options)
      @soul_id = soul_id
      @prompt = prompt
      @options = options
      { request_id: "request-123", status: "queued" }
    end
  end

  test "uses selected avatar model soul id instead of client custom reference" do
    user = User.create!(
      name: "Character Tester",
      email: "character-#{SecureRandom.hex(8)}@area69.test",
      password: "password123",
      password_confirmation: "password123",
      credits: 100
    )
    model = user.avatar_models.create!(
      name: "Mel Maia",
      style: "realistic",
      status: "ready",
      soul_id: "69e2e1cd-5094-49f1-907f-ca8c0adc5353"
    )
    fake_service = FakeHiggsfieldService.new

    HiggsfieldService.stub(:new, fake_service) do
      post "/api/generate/character",
        params: {
          model_id: model.id,
          prompt: "selfie editorial na praia, rosto visivel, olhando para camera",
          custom_reference: {
            id: "wrong-reference-id",
            name: "Wrong Model"
          },
          result_images: 1,
          enhance_prompt: true
        },
        headers: auth_headers(user),
        as: :json
    end

    assert_response :success
    assert_equal model.soul_id, fake_service.soul_id
    assert_equal "Mel Maia", fake_service.options[:custom_reference_name]
    assert_equal Api::GenerateController::REALISTIC_SOUL_STYLE_ID, fake_service.options[:style_id]
    assert_includes fake_service.prompt, "Use the selected trained custom reference as the same person."
    assert_includes fake_service.prompt, "The face must be visible and recognizable"
    assert_includes fake_service.prompt, "User prompt: selfie editorial na praia"

    job = user.generation_jobs.order(:created_at).last
    assert_equal model.id, job.avatar_model_id
    assert_equal model.soul_id, job.metadata["provider_reference_id"]
    assert_equal "Mel Maia", job.metadata["provider_custom_reference_name"]
    assert_equal Api::GenerateController::REALISTIC_SOUL_STYLE_ID, job.metadata["provider_style_id"]
  end

  private

  def auth_headers(user)
    token = JWT.encode(
      { user_id: user.id, exp: 24.hours.from_now.to_i },
      Rails.application.secret_key_base,
      "HS256"
    )
    { "Authorization" => "Bearer #{token}" }
  end
end
