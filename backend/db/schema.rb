# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_05_12_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "avatar_models", force: :cascade do |t|
    t.text "cover"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "higgsfield_request_id"
    t.integer "images_generated", default: 0, null: false
    t.string "name", null: false
    t.string "soul_id"
    t.string "status", default: "ready", null: false
    t.string "style", default: "realistic", null: false
    t.integer "training_images_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.integer "videos_generated", default: 0, null: false
    t.index ["user_id"], name: "index_avatar_models_on_user_id"
  end

  create_table "credit_purchases", force: :cascade do |t|
    t.integer "amount_total"
    t.datetime "created_at", null: false
    t.integer "credits", null: false
    t.string "currency"
    t.jsonb "metadata", default: {}
    t.string "status", default: "pending", null: false
    t.string "stripe_checkout_session_id", null: false
    t.string "stripe_payment_intent_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["stripe_checkout_session_id"], name: "index_credit_purchases_on_stripe_checkout_session_id", unique: true
    t.index ["user_id"], name: "index_credit_purchases_on_user_id"
  end

  create_table "credit_transactions", force: :cascade do |t|
    t.integer "amount", null: false
    t.integer "balance_after", null: false
    t.integer "balance_before", null: false
    t.datetime "created_at", null: false
    t.string "idempotency_key", null: false
    t.string "kind", null: false
    t.jsonb "metadata", default: {}
    t.string "reference_id"
    t.string "reference_type"
    t.string "source", null: false
    t.string "status", default: "posted", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["idempotency_key"], name: "index_credit_transactions_on_idempotency_key", unique: true
    t.index ["reference_type", "reference_id"], name: "index_credit_transactions_on_reference_type_and_reference_id"
    t.index ["source"], name: "index_credit_transactions_on_source"
    t.index ["user_id", "created_at"], name: "index_credit_transactions_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_credit_transactions_on_user_id"
  end

  create_table "generation_jobs", force: :cascade do |t|
    t.string "aspect_ratio"
    t.bigint "avatar_model_id"
    t.datetime "charged_at"
    t.datetime "completed_at"
    t.integer "cost_credits", null: false
    t.datetime "created_at", null: false
    t.integer "duration"
    t.text "error_message"
    t.string "generation_type", null: false
    t.string "idempotency_key", null: false
    t.jsonb "input_urls", default: []
    t.jsonb "metadata", default: {}
    t.jsonb "output_urls", default: []
    t.text "prompt"
    t.string "provider", null: false
    t.string "provider_model"
    t.string "provider_request_id"
    t.datetime "refunded_at"
    t.string "resolution"
    t.string "seed"
    t.string "status", default: "queued", null: false
    t.text "thumbnail_url"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["avatar_model_id"], name: "index_generation_jobs_on_avatar_model_id"
    t.index ["idempotency_key"], name: "index_generation_jobs_on_idempotency_key", unique: true
    t.index ["provider", "provider_request_id"], name: "idx_gen_jobs_on_provider_request", unique: true, where: "(provider_request_id IS NOT NULL)"
    t.index ["user_id", "status", "created_at"], name: "index_generation_jobs_on_user_id_and_status_and_created_at"
    t.index ["user_id"], name: "index_generation_jobs_on_user_id"
  end

  create_table "generations", force: :cascade do |t|
    t.string "aspect_ratio"
    t.datetime "created_at", null: false
    t.integer "duration"
    t.bigint "generation_job_id"
    t.string "generation_type", null: false
    t.integer "height"
    t.string "model_name", null: false
    t.text "prompt", null: false
    t.string "provider"
    t.string "provider_model"
    t.string "resolution"
    t.string "seed"
    t.text "thumbnail_url"
    t.datetime "updated_at", null: false
    t.text "url", null: false
    t.bigint "user_id", null: false
    t.integer "width"
    t.index ["generation_job_id", "url"], name: "idx_generations_on_job_and_url", unique: true, where: "(generation_job_id IS NOT NULL)"
    t.index ["generation_job_id"], name: "index_generations_on_generation_job_id"
    t.index ["user_id"], name: "index_generations_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.text "avatar"
    t.datetime "created_at", null: false
    t.integer "credits", default: 100, null: false
    t.string "email", null: false
    t.integer "images_generated", default: 0, null: false
    t.string "name", null: false
    t.string "password_digest", null: false
    t.string "stripe_checkout_session_id"
    t.string "stripe_customer_id"
    t.datetime "updated_at", null: false
    t.integer "videos_generated", default: 0, null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
  end

  add_foreign_key "avatar_models", "users"
  add_foreign_key "credit_purchases", "users"
  add_foreign_key "credit_transactions", "users"
  add_foreign_key "generation_jobs", "avatar_models"
  add_foreign_key "generation_jobs", "users"
  add_foreign_key "generations", "users"
end
