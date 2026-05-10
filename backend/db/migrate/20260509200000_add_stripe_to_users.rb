class AddStripeToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :stripe_customer_id, :string
    add_index  :users, :stripe_customer_id, unique: true
    add_column :users, :stripe_checkout_session_id, :string
  end
end
