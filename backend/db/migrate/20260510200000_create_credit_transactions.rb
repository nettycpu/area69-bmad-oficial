class CreateCreditTransactions < ActiveRecord::Migration[8.1]
  def change
    create_table :credit_transactions do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :amount, null: false
      t.integer :balance_before, null: false
      t.integer :balance_after, null: false
      t.string :kind, null: false
      t.string :source, null: false
      t.string :status, null: false, default: "posted"
      t.string :reference_type
      t.string :reference_id
      t.string :idempotency_key, null: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :credit_transactions, :idempotency_key, unique: true
    add_index :credit_transactions, [:user_id, :created_at]
    add_index :credit_transactions, :source
    add_index :credit_transactions, [:reference_type, :reference_id]
  end
end
