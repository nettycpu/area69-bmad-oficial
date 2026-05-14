require "test_helper"

class UserSettingsTest < ActiveSupport::TestCase
  test "defaults settings for new users" do
    user = build_user

    assert_equal "pt-BR", user.language
    assert user.notify_generations
    assert_not user.notify_promotions
  end

  test "validates supported languages" do
    user = build_user
    user.language = "fr"

    assert_not user.valid?
    assert_includes user.errors[:language], "is not included in the list"
  end

  private

  def build_user
    User.create!(
      name: "Settings Tester",
      email: "settings-#{SecureRandom.hex(8)}@area69.test",
      password: "password123",
      password_confirmation: "password123"
    )
  end
end
