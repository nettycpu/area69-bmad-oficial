class CreateCreditPurchases < ActiveRecord::Migration[8.1]
  def change
    create_table :credit_purchases do |t|
      t.references :user, null: false, foreign_key: true
      t.string :stripe_checkout_session_id, null: false
      t.string :stripe_payment_intent_id
      t.integer :credits, null: false
      t.integer :amount_total
      t.string :currency
      t.string :status, null: false, default: "pending"
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :credit_purchases, :stripe_checkout_session_id, unique: true
  end
end
