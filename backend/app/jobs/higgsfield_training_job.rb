class HiggsfieldTrainingJob < ApplicationJob
  queue_as :default
  retry_on StandardError, attempts: 0

  def perform(model_id, job_id)
    model  = AvatarModel.find(model_id)
    job    = GenerationJob.find(job_id)
    image_urls = job.input_urls || []

    raise "Nenhuma imagem para training" if image_urls.empty?

    # Cover ja foi salvo pelo controller no momento do upload
    unless model.cover.present?
      model.update!(cover: image_urls.first)
    end

    service = HiggsfieldService.new
    result  = service.train_soul(name: model.name, image_urls: image_urls)

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

end
