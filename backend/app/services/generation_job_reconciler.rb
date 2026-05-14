require "net/http"
require "json"

class GenerationJobReconciler
  WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3".freeze
  LIMIT = 20

  def initialize(user)
    @user = user
  end

  def call
    reconcile_wavespeed_jobs
  end

  private

  attr_reader :user

  def reconcile_wavespeed_jobs
    api_key = ENV["WAVESPEED_API_KEY"]
    return if api_key.blank?

    pending_wavespeed_jobs.each do |job|
      reconcile_wavespeed_job(job, api_key)
    rescue => e
      Rails.logger.warn("[GenerationJobReconciler] job=#{job.id} #{e.class}: #{e.message[0..200]}")
    end
  end

  def pending_wavespeed_jobs
    user.generation_jobs
        .pending
        .where(provider: "wavespeed", generation_type: %w[image video])
        .where.not(provider_request_id: [nil, ""])
        .order(created_at: :desc)
        .limit(LIMIT)
  end

  def reconcile_wavespeed_job(job, api_key)
    body, status_code = wavespeed_get("#{WAVESPEED_API_BASE}/predictions/#{job.provider_request_id}/result", api_key)
    normalized = WavespeedPayload.normalize(body)

    if status_code == 200 && normalized[:status] == "completed" && normalized[:outputs].any?
      GenerationJobFinalizer.complete!(job, outputs: normalized[:outputs])
    elsif status_code == 200 && normalized[:status] == "failed"
      GenerationJobFinalizer.fail!(job, normalized[:error] || "Provider returned failed status")
    elsif status_code == 200
      mark_processing!(job)
    end
  end

  def mark_processing!(job)
    return if job.status == "processing"

    metadata = job.metadata || {}
    metadata["last_reconciled_at"] = Time.current.iso8601
    job.update!(status: "processing", metadata: metadata)
  end

  def wavespeed_get(url, api_key)
    uri = URI(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 20
    req = Net::HTTP::Get.new(uri)
    req["Authorization"] = "Bearer #{api_key}"
    resp = http.request(req)
    [JSON.parse(resp.body), resp.code.to_i]
  end
end
