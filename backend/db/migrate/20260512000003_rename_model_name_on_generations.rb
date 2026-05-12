class RenameModelNameOnGenerations < ActiveRecord::Migration[8.1]
  def change
    rename_column :generations, :model_name, :model_label
  end
end
