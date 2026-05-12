class CreateGenerationJobs < ActiveRecord::Migration[8.1]
  def change
    create_table :generation_jobs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :avatar_model, null: true, foreign_key: true
      t.string :provider, null: false
      t.string :provider_model
      t.string :generation_type, null: false
      t.string :status, null: false, default: "queued"
      t.string :provider_request_id
      t.integer :cost_credits, null: false
      t.text :prompt
      t.jsonb :input_urls, default: []
      t.jsonb :output_urls, default: []
      t.text :thumbnail_url
      t.string :aspect_ratio
      t.string :resolution
      t.integer :duration
      t.string :seed
      t.text :error_message
      t.datetime :charged_at
      t.datetime :refunded_at
      t.datetime :completed_at
      t.string :idempotency_key, null: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :generation_jobs, :idempotency_key, unique: true
    add_index :generation_jobs, [:provider, :provider_request_id], unique: true, where: "provider_request_id IS NOT NULL", name: "idx_gen_jobs_on_provider_request"
    add_index :generation_jobs, [:user_id, :status, :created_at]
  end
end
