class AddUniqueIndexToGenerationsOnJobAndUrl < ActiveRecord::Migration[8.1]
  def change
    add_index :generations, [:generation_job_id, :url],
              unique: true,
              where: "generation_job_id IS NOT NULL",
              name: "idx_generations_on_job_and_url"
  end
end
