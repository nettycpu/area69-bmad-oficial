class RemoveTrainingImagesFromAvatarModels < ActiveRecord::Migration[8.1]
  def change
    remove_column :avatar_models, :training_images, :jsonb, default: []
  end
end
