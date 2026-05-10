class CreateAvatarModels < ActiveRecord::Migration[8.1]
  def change
    create_table :avatar_models do |t|
      t.references :user,  null: false, foreign_key: true
      t.string :name,        null: false
      t.string :style,       null: false, default: "realistic"
      t.text   :cover
      t.string  :status,           null: false, default: "ready"
      t.text    :description
      t.integer :images_generated, null: false, default: 0
      t.integer :videos_generated, null: false, default: 0
      t.timestamps
    end
  end
end
