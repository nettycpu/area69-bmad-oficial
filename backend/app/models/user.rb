class User < ApplicationRecord
  has_secure_password

  has_many :avatar_models, dependent: :destroy
  has_many :generations,   dependent: :destroy
  has_many :credit_transactions, dependent: :destroy
  has_many :credit_purchases, dependent: :destroy
  has_many :generation_jobs, dependent: :destroy

  validates :name,     presence: true, length: { minimum: 2, maximum: 100 }
  validates :email,    presence: true, uniqueness: { case_sensitive: false },
                       format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :credits,  numericality: { greater_than_or_equal_to: 0 }
  validates :password, length: { minimum: 8 }, allow_nil: true
  validates :language, inclusion: { in: %w[pt-BR en es] }

  before_save :downcase_email

  def as_json(options = {})
    super(options.merge(except: %i[password_digest created_at updated_at]))
  end

  private

  def downcase_email
    self.email = email.downcase
  end
end
