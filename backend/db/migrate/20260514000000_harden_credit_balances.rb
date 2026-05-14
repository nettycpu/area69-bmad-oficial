class HardenCreditBalances < ActiveRecord::Migration[8.1]
  def up
    change_column_default :users, :credits, from: 100, to: 0

    execute <<~SQL.squish
      UPDATE users
      SET credits = COALESCE(ledger.balance, 0)
      FROM (
        SELECT users.id, COALESCE(SUM(credit_transactions.amount), 0) AS balance
        FROM users
        LEFT JOIN credit_transactions
          ON credit_transactions.user_id = users.id
         AND credit_transactions.status = 'posted'
        GROUP BY users.id
      ) AS ledger
      WHERE users.id = ledger.id
        AND users.credits <> COALESCE(ledger.balance, 0)
    SQL

    add_check_constraint :users, "credits >= 0", name: "users_credits_nonnegative"
  end

  def down
    remove_check_constraint :users, name: "users_credits_nonnegative"
    change_column_default :users, :credits, from: 0, to: 100
  end
end
