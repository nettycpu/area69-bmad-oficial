class AddSettingsToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :language, :string, null: false, default: "pt-BR"
    add_column :users, :notify_generations, :boolean, null: false, default: true
    add_column :users, :notify_promotions, :boolean, null: false, default: false

    add_check_constraint :users, "language IN ('pt-BR', 'en', 'es')", name: "users_language_allowed"
  end
end
