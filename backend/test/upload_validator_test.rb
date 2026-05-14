require "test_helper"

class UploadValidatorTest < ActiveSupport::TestCase
  test "accepts valid remote reference urls" do
    assert UploadValidator.validate_reference_input("https://cdn.area69.test/reference.png")
  end

  test "rejects unsafe remote reference urls" do
    error = assert_raises(UploadValidator::ValidationError) do
      UploadValidator.validate_reference_input("javascript:alert(1)")
    end

    assert_equal "URL de imagem de referencia invalida", error.message
  end

  test "rejects invalid reference data urls" do
    error = assert_raises(UploadValidator::ValidationError) do
      UploadValidator.validate_reference_input("data:image/png;base64,not-base64")
    end

    assert_equal "Dados de imagem corrompidos (base64 invalido)", error.message
  end

  test "limits reference image count" do
    refs = Array.new(7, "https://cdn.area69.test/reference.png")

    error = assert_raises(UploadValidator::ValidationError) do
      UploadValidator.validate_reference_inputs(refs, max: 6)
    end

    assert_equal "Maximo de 6 imagens de referencia", error.message
  end
end
