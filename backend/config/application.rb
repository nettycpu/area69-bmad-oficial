require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "rails/test_unit/railtie"

Bundler.require(*Rails.groups)

module Area69
  class Application < Rails::Application
    config.load_defaults 8.1
    config.api_only = true

    # Use SESSION_SECRET as stable secret key base if dedicated key not set
    config.secret_key_base = ENV["SECRET_KEY_BASE"] ||
                              ENV["SESSION_SECRET"] ||
                              SecureRandom.hex(64)

    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins(
          if Rails.env.production?
            ENV.fetch("ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:empty?)
          else
            "*"
          end
        )
        resource "*",
          headers: :any,
          methods: %i[get post put patch delete options head],
          expose: %w[Authorization]
      end
    end
  end
end
