class AddTrainingImagesToAvatarModels < ActiveRecord::Migration[8.1]
  def change
    add_column :avatar_models, :training_images, :jsonb, default: []
  end
end
