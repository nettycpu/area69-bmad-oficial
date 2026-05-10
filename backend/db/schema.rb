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

ActiveRecord::Schema[8.1].define(version: 2026_05_09_200000) do
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

  create_table "generations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "generation_type", null: false
    t.integer "height"
    t.string "model_name", null: false
    t.text "prompt", null: false
    t.string "seed"
    t.datetime "updated_at", null: false
    t.text "url", null: false
    t.bigint "user_id", null: false
    t.integer "width"
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
  add_foreign_key "generations", "users"
end
