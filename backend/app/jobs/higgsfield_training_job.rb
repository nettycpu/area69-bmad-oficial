require "aws-sdk-s3"
require "securerandom"

class HiggsfieldTrainingJob < ApplicationJob
  queue_as :default
  retry_on StandardError, attempts: 0

  def perform(model_id, job_id)
    model  = AvatarModel.find(model_id)
    job    = GenerationJob.find(job_id)
    images = model.training_images || []

    raise "Nenhuma imagem para training" if images.empty?

    public_urls = upload_images_to_r2(model, images)

    # Salvar cover imediatamente apos upload
    if public_urls.first.present?
      model.update!(cover: public_urls.first)
      job.update!(input_urls: public_urls)
    end

    service = HiggsfieldService.new
    result  = service.train_soul(name: model.name, image_urls: public_urls)

    request_id   = result[:request_id]
    reference_id = result[:reference_id]
    result_status = result[:status]

    Rails.logger.info("[Higgsfield] Submitted OK — request_id=#{request_id} reference_id=#{reference_id} status=#{result_status}")

    updates = { higgsfield_request_id: request_id, soul_id: reference_id }
    if result_status == "completed" || result_status == "ready"
      updates[:status] = "ready"
      job.update!(status: "completed", provider_request_id: request_id, completed_at: Time.current)
    else
      job.update!(status: "processing", provider_request_id: request_id)
    end
    model.update!(updates.compact)
  rescue => e
    status_code = e.respond_to?(:status_code) ? e.status_code : "N/A"
    clean_error = e.message.to_s.gsub(/https:\/\/[^\s,]+/, '[URL_REMOVED]')
    Rails.logger.error("HIGGSFIELD API ERROR: #{e.class} — status=#{status_code} — #{clean_error[0..1000]}")

    model&.update!(status: "failed")
    job&.update!(status: "failed", error_message: clean_error[0..500])

    # Reembolso idempotente via CreditLedger
    unless job&.refunded_at
      begin
        CreditLedger.refund!(
          user: model.user,
          amount: Pricing::HIGGSFIELD_TRAINING,
          source: "higgsfield_training",
          idempotency_key: "training:avatar_model:#{model.id}:refund",
          reference: job,
          metadata: { model_id: model.id, error: clean_error[0..200] }
        )
        job&.update!(refunded_at: Time.current)
      rescue => refund_error
        Rails.logger.error("[Training] Erro ao reembolsar: #{refund_error.message}")
      end
    end
  end

  private

  def upload_images_to_r2(model, image_data_urls)
    public_host = ENV.fetch("R2_PUBLIC_URL_HOST")
    bucket_name = ENV.fetch("R2_BUCKET")
    raise "R2_PUBLIC_URL_HOST nao configurado" if public_host.blank?
    raise "R2_BUCKET nao configurado" if bucket_name.blank?

    s3 = Aws::S3::Resource.new(
      region: "auto",
      endpoint: ENV.fetch("R2_ENDPOINT"),
      access_key_id: ENV.fetch("R2_ACCESS_KEY_ID"),
      secret_access_key: ENV.fetch("R2_SECRET_ACCESS_KEY")
    )

    mime_to_ext = {
      "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp",
      "image/gif" => "gif", "image/avif" => "avif", "image/tiff" => "tiff",
    }.freeze

    bucket = s3.bucket(bucket_name)
    keys = []

    image_data_urls.each do |data_url|
      mime = data_url[/^data:([^;]+);/, 1] || "image/png"
      raw  = data_url.split(",", 2).second || data_url
      decoded = Base64.decode64(raw)
      ext = mime_to_ext[mime] || "jpg"
      key = "training/#{model.id}/#{SecureRandom.uuid}.#{ext}"
      bucket.object(key).put(body: decoded, content_type: mime)
      keys << key
    end

    keys.map { |key| "#{public_host}/#{key}" }
  end
end
