class AddJobFieldsToGenerations < ActiveRecord::Migration[8.1]
  def change
    add_column :generations, :generation_job_id, :bigint
    add_column :generations, :thumbnail_url, :text
    add_column :generations, :provider, :string
    add_column :generations, :provider_model, :string
    add_column :generations, :aspect_ratio, :string
    add_column :generations, :resolution, :string
    add_column :generations, :duration, :integer

    add_index :generations, :generation_job_id
  end
end
