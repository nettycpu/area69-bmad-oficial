# PRD: Stripe Checkout — Integração de Pagamentos

**Status:** Draft para Aprovação
**Autor:** Arquiteto de Software — Metodologia BMAD
**Data:** 2026-05-09
**Referência Backend:** Rails 8.1, PostgreSQL
**Referência Frontend:** React + TypeScript (Vite)

---

## 1. Diagnóstico do Estado Atual

### 1.1 Tabela `users` (schema.rb)

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | bigint | auto | PK |
| `name` | string | required | Nome do usuário |
| `email` | string | required, unique | Login |
| `password_digest` | string | required | BCrypt hash |
| `credits` | integer | **100** | Moeda interna para geração |
| `avatar` | text | nullable | Avatar URL |
| `images_generated` | integer | 0 | Contador de imagens |
| `videos_generated` | integer | 0 | Contador de vídeos |
| `created_at` / `updated_at` | datetime | auto | Timestamps |

**Ausente:** Nenhuma coluna Stripe existe (`stripe_customer_id`, subscription status, etc.)

### 1.2 Model `User` (`app/models/user.rb`)

- `has_secure_password` (BCrypt)
- `has_many :avatar_models`, `has_many :generations`
- Validações: name (2-100), email (unique + regex), credits (>= 0), password (min 8)
- `before_save :downcase_email`
- `as_json` omite `password_digest`, `created_at`, `updated_at`

### 1.3 Checkout Atual (`Checkout.tsx`)

**É 100% fake.** Gera um QR Code PIX no client-side (campo `txid` não existe como entidade real no banco), sem nenhuma validação no backend. O botão "Confirmar Pagamento (Demo)" simplesmente chama `addCredits()` localmente. Existe um aviso amarelo "Ambiente de demonstração — pagamento simulado".

### 1.4 Credits Controller (`credits_controller.rb`)

- `balance`: GET — retorna `current_user.credits`
- `add`: POST — adiciona créditos (protegido por `X-Credits-Secret` header)
- `spend`: POST — deduz créditos com race-condition protection (`update_all` com `WHERE credits >= ?`)

### 1.5 Stripe no Backend

**Zero.** Nenhuma referência à gem `stripe`, nenhum initializer, zero webhook endpoints.

---

## 2. Objetivo

Substituir o sistema de checkout simulado (PIX fake no client-side) por uma integração real com **Stripe Checkout**, mantendo o modelo de créditos pré-pagos (não assinatura recorrente nesta fase). O fluxo será:

```
Usuário → Pricing.tsx → POST /api/checkout/create-session
  → StripeService → Stripe API → Checkout Session URL
  → Usuário paga no Stripe
  → Stripe webhook → POST /api/webhooks/stripe
  → StripeWebhookController → verifica assinatura → injeta créditos
```

---

## 3. Plano de Execução — 5 Etapas

### ETAPA 1 — Banco de Dados: Migration para `users`

#### Migration: `AddStripeToUsers`

```ruby
class AddStripeToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :stripe_customer_id, :string
    add_index  :users, :stripe_customer_id, unique: true

    # Para controle de sessão de checkout (evitar dupla cobrança)
    add_column :users, :stripe_checkout_session_id, :string
  end
end
```

**Nota:** Não adicionamos colunas de subscription/plan porque o modelo inicial é **pré-pago (one-time payment)**. Se futuramente migrarmos para assinatura, adicionaremos `subscription_status`, `stripe_subscription_id`, `plan` em uma nova migration.

**Schema final da tabela `users` após migration:**

| Coluna (nova) | Tipo | Descrição |
|---|---|---|
| `stripe_customer_id` | string, unique | ID do Customer no Stripe |
| `stripe_checkout_session_id` | string | Controle de idempotência do checkout ativo |

---

### ETAPA 2 — Setup Backend: Gem + Initializer

#### 2.1 Adicionar ao Gemfile

```ruby
gem "stripe", "~> 12.0"
```

#### 2.2 Criar `config/initializers/stripe.rb`

```ruby
Stripe.api_key = ENV.fetch("STRIPE_SECRET_KEY", "")
Stripe.api_version = "2024-06-20"
```

#### 2.3 Variáveis de Ambiente (`.env`)

```bash
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
STRIPE_PRICE_50_CREDITS=price_xxxxxxxx   # 50 créditos
STRIPE_PRICE_150_CREDITS=price_xxxxxxxx  # 150 créditos
STRIPE_PRICE_300_CREDITS=price_xxxxxxxx  # 300 créditos
STRIPE_PRICE_600_CREDITS=price_xxxxxxxx  # 600 créditos
```

**Estratégia de preços:** Usamos Products + Prices no Stripe Dashboard (não criamos via API). Cada Price ID é mapeado para uma quantidade de créditos no webhook handler via metadados do Price (`metadata: { credits: "300" }`).

---

### ETAPA 3 — Service Object: `StripeService`

**Arquivo:** `backend/app/services/stripe_service.rb`

```ruby
class StripeService
  class Error < StandardError; end

  # Mapeia quantidade de créditos → Price ID do Stripe
  PRICE_MAP = {
    50  => ENV.fetch("STRIPE_PRICE_50_CREDITS", ""),
    150 => ENV.fetch("STRIPE_PRICE_150_CREDITS", ""),
    300 => ENV.fetch("STRIPE_PRICE_300_CREDITS", ""),
    600 => ENV.fetch("STRIPE_PRICE_600_CREDITS", ""),
  }.freeze

  def initialize; end

  # ── Criar Checkout Session ──────────────────────────────────────────────

  # @param user    [User]  usuário logado
  # @param credits [Integer] quantidade de créditos (50, 150, 300, 600)
  # @param success_url [String] URL de retorno após pagamento
  # @param cancel_url  [String] URL de retorno se cancelar
  # @return [Hash] { url: String, session_id: String }
  def create_checkout_session(user:, credits:, success_url:, cancel_url:)
    price_id = PRICE_MAP[credits]
    raise Error, "Pacote de créditos inválido: #{credits}" if price_id.blank?

    customer = find_or_create_customer(user)

    session = Stripe::Checkout::Session.create({
      customer: customer.id,
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      mode: "payment",
      success_url: success_url + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancel_url,
      metadata: {
        user_id: user.id.to_s,
        credits: credits.to_s,
      },
      # Expira em 30 minutos
      expires_at: (Time.now + 30 * 60).to_i,
    })

    # Salva session_id no user para controle de idempotência
    user.update!(stripe_checkout_session_id: session.id)

    { url: session.url, session_id: session.id }
  rescue Stripe::StripeError => e
    raise Error, "Stripe API error: #{e.message}"
  end

  # ── Processar Webhook de Checkout Completado ─────────────────────────────

  # @param event [Stripe::Event] evento verificado do webhook
  # @return [Hash] { user_id:, credits_added:, session_id: }
  def handle_checkout_completed(event)
    session = event.data.object # Stripe::Checkout::Session

    user_id = session.metadata["user_id"]
    credits = session.metadata["credits"].to_i

    raise Error, "Metadados inválidos no checkout session" unless user_id.present? && credits > 0

    user = User.find(user_id)

    # Idempotência: só processa se o session_id bater com o salvo
    unless user.stripe_checkout_session_id == session.id
      # Já foi processado ou session_id não confere
      Rails.logger.warn("[Stripe] Checkout session #{session.id} já processada ou inválida para user #{user_id}")
      return { user_id: user.id, credits_added: 0, session_id: session.id, duplicate: true }
    end

    ActiveRecord::Base.transaction do
      user.increment!(:credits, credits)
      user.update!(stripe_checkout_session_id: nil) # Limpa para permitir nova compra
    end

    Rails.logger.info("[Stripe] Créditos adicionados: user=#{user.id} credits=+#{credits} session=#{session.id}")
    { user_id: user.id, credits_added: credits, session_id: session.id }
  rescue ActiveRecord::RecordNotFound
    raise Error, "Usuário não encontrado para checkout session: #{session&.id}"
  rescue Stripe::StripeError => e
    raise Error, "Stripe API error no webhook: #{e.message}"
  end

  private

  # ── Find-or-Create Stripe Customer ───────────────────────────────────────

  def find_or_create_customer(user)
    if user.stripe_customer_id.present?
      customer = Stripe::Customer.retrieve(user.stripe_customer_id)
      return customer
    end
  rescue Stripe::InvalidRequestError
    # Customer foi deletado no Stripe — recriar
  end

  def find_or_create_customer(user)
    customer = Stripe::Customer.create({
      email: user.email,
      name:  user.name,
      metadata: { user_id: user.id.to_s },
    })
    user.update!(stripe_customer_id: customer.id)
    customer
  end
end
```

**Responsabilidades do Service:**
1. `create_checkout_session` — gera URL de pagamento Stripe com metadados (user_id + credits)
2. `handle_checkout_completed` — processa evento de pagamento confirmado com idempotência
3. `find_or_create_customer` — gerencia Customer do Stripe vinculado ao User local

---

### ETAPA 4 — Segurança: Webhook Controller

**Arquivo:** `backend/app/controllers/api/webhooks_controller.rb`

```ruby
module Api
  class WebhooksController < ApplicationController
    # Desabilitar CSRF para webhooks (Stripe não envia token CSRF)
    skip_before_action :verify_authenticity_token, only: [:stripe]
    # Desabilitar autenticação de usuário (webhook é machine-to-machine)
    skip_before_action :authenticate!, only: [:stripe]

    # POST /api/webhooks/stripe
    def stripe
      payload = request.body.read
      sig_header = request.headers["Stripe-Signature"]
      webhook_secret = ENV.fetch("STRIPE_WEBHOOK_SECRET", "")

      event = Stripe::Webhook.construct_event(payload, sig_header, webhook_secret)

      case event.type
      when "checkout.session.completed"
        result = StripeService.new.handle_checkout_completed(event)
        Rails.logger.info("[StripeWebhook] checkout.session.completed processado: #{result}")
      else
        Rails.logger.info("[StripeWebhook] Evento ignorado: #{event.type}")
      end

      head :ok
    rescue JSON::ParserError
      head :bad_request
    rescue Stripe::SignatureVerificationError => e
      Rails.logger.error("[StripeWebhook] Assinatura inválida: #{e.message}")
      head :unauthorized
    rescue StripeService::Error => e
      Rails.logger.error("[StripeWebhook] Erro de negócio: #{e.message}")
      head :unprocessable_entity
    rescue => e
      Rails.logger.error("[StripeWebhook] Erro inesperado: #{e.message}")
      head :internal_server_error
    end

    private

    def authenticate!
      # Placeholder — webhooks não precisam de auth de usuário
    end
  end
end
```

#### Rotas para Webhook

```ruby
# Em config/routes.rb, dentro do scope "/api":
post "webhooks/stripe", to: "api/webhooks#stripe"
```

**Pontos de segurança implementados:**

| Mecanismo | Descrição |
|---|---|
| **Assinatura Stripe** | `Stripe::Webhook.construct_event` verifica HMAC-SHA256 do payload |
| **Idempotência** | `stripe_checkout_session_id` no User previne créditos duplicados |
| **Transação atômica** | `increment! + update!` dentro de `ActiveRecord::Base.transaction` |
| **Log estruturado** | Todo evento é logado para trilha de auditoria |
| **CSRF desabilitado** | Necessário para endpoint machine-to-machine |

---

### ETAPA 5 — Frontend: Nova Tela `Pricing.tsx`

**Arquivo:** `artifacts/area69/src/pages/Pricing.tsx` — substitui o `Checkout.tsx` atual

**Fluxo da UI:**

```
Pricing.tsx
  ├─ Grid de 4 cards de preços (50, 150, 300, 600 créditos)
  ├─ Card destacado "Melhor valor" (300 créditos)
  ├─ Botão "Comprar com Stripe" → chama api.checkout.createSession(credits)
  ├─ Redireciona para Stripe Checkout URL (window.location.href)
  └─ Tela de sucesso (opcional — query param ?session_id=xxx)
```

#### API Client — novos métodos em `api.ts`

```typescript
checkout: {
  createSession: (data: { credits: number; success_url: string; cancel_url: string }) =>
    request<{ url: string }>("/checkout/create-session", {
      method: "POST",
      body: JSON.stringify(data),
    }),
},
```

#### Controller Backend — `CheckoutController`

**Arquivo novo:** `backend/app/controllers/api/checkout_controller.rb`

```ruby
module Api
  class CheckoutController < ApplicationController
    VALID_CREDIT_PACKS = [50, 150, 300, 600].freeze

    def create_session
      credits = params[:credits].to_i
      return render_error("Pacote inválido. Opções: #{VALID_CREDIT_PACKS.join(', ')}") unless VALID_CREDIT_PACKS.include?(credits)

      success_url = params[:success_url].presence || "#{frontend_base_url}/dashboard?checkout=success"
      cancel_url  = params[:cancel_url].presence || "#{frontend_base_url}/dashboard/pricing"

      result = StripeService.new.create_checkout_session(
        user: current_user,
        credits: credits,
        success_url: success_url,
        cancel_url: cancel_url,
      )

      render json: { url: result[:url] }
    rescue StripeService::Error => e
      render_error("Erro ao criar sessão de checkout: #{e.message}", :bad_gateway)
    end

    private

    def frontend_base_url
      ENV.fetch("FRONTEND_BASE_URL", "http://localhost:5173")
    end
  end
end
```

#### Rotas

```ruby
post "checkout/create-session", to: "api/checkout#create_session"
```

---

## 4. Estrutura de Arquivos — Visão Completa

```
Novos arquivos:
  backend/
    app/services/stripe_service.rb              ← Service Object
    app/controllers/api/checkout_controller.rb  ← Checkout Session endpoint
    app/controllers/api/webhooks_controller.rb  ← Stripe webhook receiver
    config/initializers/stripe.rb               ← Stripe config
    db/migrate/XXXXXXXXXX_add_stripe_to_users.rb ← Migration

Modificados:
  backend/
    Gemfile                                     ← + gem "stripe"
    Gemfile.lock                                ← bundle install
    config/routes.rb                            ← + 2 rotas
  artifacts/area69/src/
    lib/api.ts                                  ← + api.checkout.createSession()
    App.tsx                                     ← + /dashboard/pricing → Pricing.tsx
    pages/Checkout.tsx                          ← Substituído por Pricing.tsx

Novos (frontend):
  artifacts/area69/src/pages/Pricing.tsx        ← Nova tela de preços
```

---

## 5. Fluxo de Ponta a Ponta

```
┌──────────┐     ┌────────────────┐     ┌─────────────┐     ┌──────────────┐
│ Pricing  │────▶│ CheckoutCtrl   │────▶│ StripeSvc   │────▶│ Stripe API   │
│ .tsx     │     │ #create_session│     │ #create_... │     │ Checkout     │
└──────────┘     └────────────────┘     └─────────────┘     └──────┬───────┘
                                                                    │
  Usuário vê página                                                 │
  de preços, escolhe                                                │ Session URL
  pacote (ex: 300                                                   │
  créditos), clica                                                  ▼
  "Comprar"                                              ┌────────────────────┐
                                                          │ Stripe Checkout    │
                                                          │ (página externa)   │
  Usuário paga                                           │ - Cartão, PIX, etc │
  com sucesso                                            └────────┬───────────┘
                                                                    │
                                                                    │ webhook
                                                                    ▼
┌──────────┐     ┌────────────────┐     ┌─────────────┐     ┌──────────────┐
│ Usuário  │◀───│ User.credits  │◀────│ WebhookCtrl │◀────│ Stripe Event │
│ +300     │     │ += 300        │     │ #stripe     │     │ checkout.    │
│ créditos │     │ (atomico)     │     │ (sig verify)│     │ session.     │
└──────────┘     └────────────────┘     └─────────────┘     │ completed    │
                                                            └──────────────┘
```

---

## 6. Sequência de Execução

| Ordem | Atividade | Entregável |
|---|---|---|
| 1 | Criar migration `AddStripeToUsers` | `db/migrate/..._add_stripe_to_users.rb` |
| 2 | Rodar `rails db:migrate` | Schema atualizado |
| 3 | Adicionar `gem "stripe"` ao Gemfile + `bundle install` | Dependência instalada |
| 4 | Criar `config/initializers/stripe.rb` | Configuração da gem |
| 5 | Criar `StripeService` | `app/services/stripe_service.rb` |
| 6 | Criar `WebhooksController` | `app/controllers/api/webhooks_controller.rb` |
| 7 | Criar `CheckoutController` | `app/controllers/api/checkout_controller.rb` |
| 8 | Adicionar rotas | `config/routes.rb` atualizado |
| 9 | Configurar Products + Prices no Stripe Dashboard | 4 prices com metadados |
| 10 | Configurar Webhook endpoint no Stripe Dashboard | `.../api/webhooks/stripe` |
| 11 | Adicionar `api.checkout.createSession()` no frontend | `api.ts` atualizado |
| 12 | Criar `Pricing.tsx` | Nova página de preços |
| 13 | Adicionar rota `/dashboard/pricing` | `App.tsx` atualizado |
| 14 | Teste end-to-end com Stripe test mode | 1 compra completa validada |

---

## 7. Pontos de Atenção (Risk Register)

| Risco | Mitigação |
|---|---|
| Webhook recebido antes do DB commit | Idempotência via `stripe_checkout_session_id` — retry do Stripe reentrega e processa |
| Customer ID órfão (deletado no Stripe) | `find_or_create_customer` captura `InvalidRequestError` e recria |
| Price ID inválido no .env | `StripeService` valida presença do Price ID antes de criar sessão |
| CSRF bloqueando webhook | `skip_before_action :verify_authenticity_token` |
| Timezone no `expires_at` | `Time.now.to_i` (UTC) — Stripe espera Unix timestamp |

---

## 8. Aprovação

- [ ] Migration executada e schema verificado
- [ ] Stripe test mode configurado (keys + webhook secret)
- [ ] Fluxo completo testado: Pricing → Stripe → Webhook → Créditos
- [ ] Idempotência testada (reenviar mesmo webhook → créditos não duplicam)
