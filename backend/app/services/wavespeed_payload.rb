class WavespeedPayload
  FAILURE_STATUSES = %w[failed error canceled cancelled timeout timed_out].freeze
  PROCESSING_STATUSES = %w[queued created processing running submitted pending].freeze

  def self.normalize(body)
    root = body.is_a?(Hash) ? body : {}
    data = root["data"].is_a?(Hash) ? root["data"] : root
    outputs = extract_outputs(root)
    raw_status = (data["status"] || root["status"] || "processing").to_s.downcase
    raw_error = first_present(data["error"], root["error"])
    raw_error ||= first_present(data["message"])
    raw_error ||= root["message"] if root["message"].to_s.downcase != "success"

    status = if raw_status == "completed" && outputs.any?
               "completed"
             elsif FAILURE_STATUSES.include?(raw_status) || raw_error.present?
               "failed"
             elsif PROCESSING_STATUSES.include?(raw_status)
               "processing"
             else
               "processing"
             end

    {
      provider_id: first_present(data["id"], root["id"], data["request_id"], root["request_id"]),
      status: status,
      outputs: outputs,
      error: raw_error
    }
  end

  def self.extract_outputs(payload)
    containers = output_containers(payload)
    containers.flat_map { |container| output_values(container) }
              .filter_map { |value| normalize_output(value) }
              .uniq
  end

  def self.first_present(*values)
    values.find { |value| value.present? }
  end
  private_class_method :first_present

  def self.output_containers(payload)
    return [] unless payload.is_a?(Hash)

    [payload, payload["data"], payload["result"], payload.dig("data", "result")]
      .select { |value| value.is_a?(Hash) }
      .uniq
  end
  private_class_method :output_containers

  def self.output_values(container)
    values = []
    %w[outputs images result_images].each do |key|
      values.concat(Array(container[key])) if container[key].is_a?(Array)
    end
    %w[output image url].each do |key|
      values << container[key] if container[key].present?
    end
    values
  end
  private_class_method :output_values

  def self.normalize_output(value)
    case value
    when String
      value if value.start_with?("http://", "https://")
    when Hash
      first_present(
        value["url"],
        value["uri"],
        value["src"],
        value["image_url"],
        value.dig("image", "url")
      )
    end
  end
  private_class_method :normalize_output
end
