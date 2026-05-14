require "uri"

class UploadValidator
  ALLOWED_MIME_TYPES = %w[image/jpeg image/png image/webp].freeze

  JPEG_MAGIC         = [0xFF, 0xD8].freeze
  PNG_MAGIC          = [0x89, 0x50, 0x4E, 0x47].freeze
  WEBP_RIFF_MAGIC    = [0x52, 0x49, 0x46, 0x46].freeze
  WEBP_FORMAT_MAGIC  = [0x57, 0x45, 0x42, 0x50].freeze

  MAGIC_BYTES = {
    "image/jpeg" => ->(bytes) { bytes.size >= 2 && bytes[0, 2] == JPEG_MAGIC },
    "image/png"  => ->(bytes) { bytes.size >= 8 && bytes[0, 4] == PNG_MAGIC },
    "image/webp" => ->(bytes) { bytes.size >= 12 && bytes[0, 4] == WEBP_RIFF_MAGIC && bytes[8, 4] == WEBP_FORMAT_MAGIC },
  }.freeze

  MAX_REFERENCE_SIZE = 10.megabytes
  MAX_TRAINING_PER_IMAGE = 10.megabytes
  MAX_TRAINING_TOTAL = 200.megabytes

  class ValidationError < StandardError; end

  def self.validate_reference_input(value)
    raise ValidationError, "Imagem de referencia invalida" if value.blank?

    if value.start_with?("data:")
      validate_data_url(value, context: :reference)
      return true
    end

    uri = URI.parse(value)
    unless %w[https http].include?(uri.scheme) && uri.host.present?
      raise ValidationError, "URL de imagem de referencia invalida"
    end

    true
  rescue URI::InvalidURIError
    raise ValidationError, "URL de imagem de referencia invalida"
  end

  def self.validate_reference_inputs(values, max: 6)
    raise ValidationError, "Nenhuma imagem fornecida" if values.blank?
    raise ValidationError, "Maximo de #{max} imagens de referencia" if values.size > max

    values.each { |value| validate_reference_input(value.to_s) }
    true
  end

  def self.validate_data_url(data_url, context: :reference)
    raise ValidationError, "Formato de imagem invalido" unless data_url.start_with?("data:image/")
    raise ValidationError, "Formato de imagem invalido: deve conter base64" unless data_url.include?(";base64,")

    mime = data_url[/^data:([^;]+);/, 1]
    raise ValidationError, "Tipo de imagem nao suportado: #{mime}" unless ALLOWED_MIME_TYPES.include?(mime)
    raise ValidationError, "Tipo de imagem nao suportado" if mime.blank?

    raw = data_url.split(",", 2).second
    raise ValidationError, "Dados de imagem invalidos" if raw.blank?

    begin
      decoded = Base64.strict_decode64(raw)
    rescue ArgumentError
      raise ValidationError, "Dados de imagem corrompidos (base64 invalido)"
    end

    max_size = context == :training ? MAX_TRAINING_PER_IMAGE : MAX_REFERENCE_SIZE
    if decoded.bytesize > max_size
      max_mb = max_size / 1.megabyte
      raise ValidationError, "Imagem muito grande: maximo #{max_mb}MB"
    end

    # Magic bytes validation
    checker = MAGIC_BYTES[mime]
    if checker && !checker.call(decoded.byteslice(0, 16).unpack("C*"))
      raise ValidationError, "Arquivo corrompido ou formato nao corresponde ao tipo declarado"
    end

    decoded.bytesize
  end

  def self.validate_data_urls(data_urls, context: :reference)
    raise ValidationError, "Nenhuma imagem fornecida" if data_urls.blank?

    total = 0
    data_urls.each_with_index do |url, i|
      size = validate_data_url(url, context: context)
      total += size
    end

    if context == :training && total > MAX_TRAINING_TOTAL
      raise ValidationError, "Total de imagens excede 200MB"
    end

    true
  end
end
