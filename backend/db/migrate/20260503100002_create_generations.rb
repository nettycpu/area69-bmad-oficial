class CreateGenerations < ActiveRecord::Migration[8.1]
  def change
    create_table :generations do |t|
      t.references :user,            null: false, foreign_key: true
      t.string :model_name,          null: false
      t.string :generation_type,     null: false
      t.text   :prompt,              null: false
      t.text   :url,                 null: false
      t.string :seed
      t.integer :width
      t.integer :height
      t.timestamps
    end
  end
end
