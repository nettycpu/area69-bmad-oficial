class UploadValidator
  ALLOWED_MIME_TYPES = %w[image/jpeg image/png image/webp].freeze

  MAGIC_BYTES = {
    "image/jpeg" => ->(bytes) { bytes.size >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8 },
    "image/png"  => ->(bytes) { bytes.size >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 },
    "image/webp" => ->(bytes) { bytes.size >= 12 && bytes[0..3].include?("RIFF") && bytes[8..11].include?("WEBP") },
  }.freeze

  MAX_REFERENCE_SIZE = 10.megabytes
  MAX_TRAINING_PER_IMAGE = 10.megabytes
  MAX_TRAINING_TOTAL = 200.megabytes

  class ValidationError < StandardError; end

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
