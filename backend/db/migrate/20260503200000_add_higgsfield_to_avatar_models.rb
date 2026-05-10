class AddHiggsfieldToAvatarModels < ActiveRecord::Migration[8.1]
  def change
    add_column :avatar_models, :higgsfield_request_id, :string
    add_column :avatar_models, :soul_id, :string
    add_column :avatar_models, :training_images_count, :integer, default: 0, null: false
  end
end
