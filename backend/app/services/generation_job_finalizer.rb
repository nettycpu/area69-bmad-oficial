class GenerationJobFinalizer
  def self.complete!(job, outputs:)
    new(job).complete!(outputs: outputs)
  end

  def self.fail!(job, error_message)
    new(job).fail!(error_message)
  end

  def initialize(job)
    @job = job
    @user = job.user
  end

  def complete!(outputs:)
    job.with_lock do
      if job.status == "failed" || job.refunded_at.present?
        return payload
      end

      if job.status == "completed" && job.output_urls.any? && (job.metadata || {})["generation_created"]
        return payload
      end

      job.update!(
        status: "completed",
        output_urls: outputs,
        completed_at: Time.current
      )
    end

    metadata = job.reload.metadata || {}
    create_generation_history!(metadata, outputs)
    update_user_counters!(metadata, outputs)
    update_avatar_model_counter!(metadata, outputs)
    job.update!(metadata: metadata)

    payload
  end

  def fail!(error_message)
    job.with_lock do
      return payload if job.status == "completed"

      job.update!(status: "failed", error_message: error_message)
      refund!(error_message) unless job.refunded_at
    end

    payload.merge(error: error_message)
  end

  private

  attr_reader :job, :user

  def payload
    {
      status: job.status,
      outputs: job.output_urls,
      credits: user.reload.credits
    }
  end

  def create_generation_history!(metadata, outputs)
    return if metadata["generation_created"]

    outputs.each do |url|
      user.generations.find_or_create_by!(generation_job_id: job.id, url: url) do |gen|
        gen.model_label = display_model_label
        gen.generation_type = job.generation_type
        gen.prompt = job.prompt.presence || "Generated media"
        gen.thumbnail_url = job.thumbnail_url
        gen.provider = job.provider
        gen.provider_model = job.provider_model
        gen.aspect_ratio = job.aspect_ratio
        gen.resolution = job.resolution
        gen.duration = job.duration
        gen.seed = job.seed
      end
    end

    metadata["generation_created"] = true
    metadata.delete("history_error")
  rescue => e
    Rails.logger.error("[GenerationJobFinalizer] history_error job=#{job.id} #{e.class}: #{e.message}")
    metadata["history_error"] = "#{e.class}: #{e.message}".truncate(240)
  end

  def update_user_counters!(metadata, outputs)
    return if metadata["counters_updated"]

    column = job.generation_type == "image" ? :images_generated : :videos_generated
    user.increment!(column, outputs.size)
    metadata["counters_updated"] = true
  rescue => e
    Rails.logger.error("[GenerationJobFinalizer] counters_error job=#{job.id} #{e.class}: #{e.message}")
  end

  def update_avatar_model_counter!(metadata, outputs)
    return unless job.avatar_model.present? && job.generation_type == "image"
    return if metadata["avatar_model_counter_updated"]

    job.avatar_model.increment!(:images_generated, outputs.size)
    metadata["avatar_model_counter_updated"] = true
  rescue => e
    Rails.logger.error("[GenerationJobFinalizer] avatar_counter_error job=#{job.id} #{e.class}: #{e.message}")
  end

  def refund!(error_message)
    CreditLedger.refund!(
      user: user,
      amount: job.cost_credits,
      source: job.source_for_refund,
      idempotency_key: "generation_job:#{job.id}:refund",
      reference: job,
      metadata: { error: error_message }
    )
    job.update!(refunded_at: Time.current)
  end

  def display_model_label
    return job.avatar_model.name if job.avatar_model&.name.present?

    case job.provider
    when "wavespeed"
      job.generation_type == "video" ? "AREA69 Motion Studio" : "AREA69 Image Studio"
    when "higgsfield"
      "AREA69 Character Studio"
    else
      "AREA69 Studio"
    end
  end
end
