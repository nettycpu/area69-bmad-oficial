# PRD: Higgsfield AI — Soul 2.0 Character Generation Service

**Status:** Draft para Aprovação
**Autor:** Arquiteto de Software — Metodologia BMAD (Pesquisa → Teste Unitário → Integração)
**Data:** 2026-05-09
**Referência Base:** `Api::GenerateController` (Wavespeed) — funcional 100%
**Referência Treino:** `Api::TrainingController` (Higgsfield) — parcial, somente treino

---

## 1. Contexto & Diagnóstico Atual

### 1.1 O que já existe (Higgsfield — Treino)

| Artefato | Path | Status |
|---|---|---|
| Controller de Treino | `backend/app/controllers/api/training_controller.rb` | Funcional |
| Modelo ActiveRecord | `backend/app/models/avatar_model.rb` | OK |
| Migrations (soul_id, higgsfield_request_id) | `backend/db/migrate/20260503200000_add_higgsfield_to_avatar_models.rb` | OK |
| Rotas de treino | `POST /api/training/soul_id`, `GET /api/training/:id/status` | OK |
| Frontend (Models.tsx) | `artifacts/area69/src/pages/Models.tsx` | OK — polling 8s |
| Frontend (api.ts) | `artifacts/area69/src/lib/api.ts` | OK — `api.training.*` |

**Fluxo atual (somente treino):**
```
Usuário envia 10-30 imagens → TrainingController#create
  → Deduz 150 créditos
  → Cria AvatarModel com status "training"
  → Thread.new → submit_to_higgsfield → POST /higgsfield-ai/soul/standard
  → Retorna request_id → salva em higgsfield_request_id
  → Frontend faz polling a cada 8s → poll_higgsfield_status
  → Quando status="completed" → extrai soul_id → salva no model
```

### 1.2 O que NÃO existe (Higgsfield — Geração de Imagem com Soul ID)

NÃO há endpoint, controller, ou serviço que **usa** o `soul_id` para **gerar imagens** via Higgsfield. O fluxo para quando o Soul ID é obtido. Precisamos construir esse pipeline de geração, espelhando o padrão Wavespeed.

### 1.3 O Padrão de Sucesso: Wavespeed (GenerateController)

**Arquivo:** `backend/app/controllers/api/generate_controller.rb`

| Aspecto | Implementação |
|---|---|
| Auth | `Authorization: Bearer #{ENV["WAVESPEED_API_KEY"]}` |
| SSL | `VERIFY_PEER` + custom cert store (CRL disabled) |
| POST (create) | `wavespeed_post(url, payload, api_key)` — retorna `[body, status_code]` |
| GET (status) | `wavespeed_get(url, api_key)` — retorna `[body, status_code]` |
| Timeouts | POST: 60s read, GET: 30s read |
| Response create | `{ data: { id, status } }` → frontend recebe `{ prediction_id, status }` |
| Response status | `{ data: { status, outputs, error } }` → frontend recebe polling data |
| Rotas | `POST /api/generate/image` e `GET /api/generate/image/:id` |
| Frontend | `api.generate.image()` + polling a cada 2.5s por até 60 tentativas |

---

## 2. Escopo & Objetivo do PRD

Criar o **serviço de geração de imagens via Higgsfield Soul 2.0 (Character)** que permita ao usuário, de posse de um AvatarModel com `soul_id` preenchido, gerar imagens usando a API da Higgsfield. O serviço deve seguir o mesmo padrão arquitetural do Wavespeed (`GenerateController`), garantindo consistência, reaproveitamento de padrões e baixa fricção de manutenção.

---

## 3. Plano de Implementação Passo a Passo

### FASE 1 — Pesquisa (BMAD: Research First)

#### Passo 1.1: Confirmar o Endpoint de Geração da Higgsfield

A Higgsfield AI expõe uma API REST documentada. Precisamos confirmar:

- **Endpoint de geração com Soul ID:** `POST https://platform.higgsfield.ai/v1/soul/generate` ou `POST https://platform.higgsfield.ai/higgsfield-ai/soul/character`
- **Endpoint de status/polling:** `GET https://platform.higgsfield.ai/requests/{request_id}/status` (padrão já usado no treino)
- **Documentação oficial:** https://docs.higgsfield.ai (verificar API reference atualizada)

**Ação:** Fazer uma chamada cURL manual para validar o endpoint, payload e response shape.

**cURL de referência esperado:**
```bash
curl -X POST "https://platform.higgsfield.ai/v1/soul/generate" \
  -H "Authorization: Key ${HIGGSFIELD_API_KEY}:${HIGGSFIELD_API_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "soul_id": "<UUID_DO_MODEL_TREINADO>",
    "prompt": "a photo of trigger_word wearing a black suit",
    "num_images": 1
  }'
```

#### Passo 1.2: Documentar o Response Shape Real

Registrar exatamente o que a API retorna em caso de sucesso (200/201) e erro, para alimentar os testes unitários.

**Formato esperado (a confirmar):**
```json
// POST response (submit)
{
  "request_id": "uuid-string",
  "status": "processing"
}

// GET response (polling)
{
  "status": "completed",
  "outputs": ["https://...jpg", "https://...jpg"],
  "request_id": "uuid-string"
}
```

#### Passo 1.3: Confirmar o Schema de Auth

O treino usa `Authorization: Key <key>:<secret>`. Confirmar se a geração usa o mesmo formato ou `Bearer`.

**Auth atual do treino (TrainingController#higgsfield_auth):**
```ruby
def higgsfield_auth
  key    = ENV.fetch("HIGGSFIELD_API_KEY", "")
  secret = ENV.fetch("HIGGSFIELD_API_SECRET", "")
  "Key #{key}:#{secret}"
end
```

---

### FASE 2 — Criação do Service Object `HiggsfieldService`

#### Passo 2.1: Criar `backend/app/services/higgsfield_service.rb`

Extrair a lógica HTTP da Higgsfield dos controllers inline para um Service Object dedicado, assim como o ADR do projeto pedia para a Wavespeed (mas que nunca foi feito). Vamos começar certo com a Higgsfield.

**Estrutura proposta do Service:**

```ruby
# backend/app/services/higgsfield_service.rb
require "net/http"
require "uri"
require "json"
require "openssl"

class HiggsfieldService
  HIGGSFIELD_BASE = "https://platform.higgsfield.ai"

  class Error < StandardError; end
  class TimeoutError < Error; end
  class APIError < Error
    attr_reader :status_code
    def initialize(message, status_code)
      super(message)
      @status_code = status_code
    end
  end

  def initialize
    @api_key    = ENV.fetch("HIGGSFIELD_API_KEY", "")
    @api_secret = ENV.fetch("HIGGSFIELD_API_SECRET", "")
    raise Error.new("HIGGSFIELD_API_KEY e HIGGSFIELD_API_SECRET devem estar definidos") if @api_key.blank? || @api_secret.blank?
  end

  # === Geração de Imagem com Soul ID ===

  # Submete um job de geração de imagem usando um Soul ID treinado
  # @param soul_id [String] UUID do modelo treinado
  # @param prompt  [String] prompt de geração
  # @param options [Hash] opções adicionais (images, seed, num_images, aspect_ratio, etc.)
  # @return [Hash] { request_id:, status: }
  def generate_image(soul_id:, prompt:, **options)
    payload = {
      soul_id: soul_id,
      prompt: prompt
    }.merge(options)

    body, status = post("/v1/soul/generate", payload)

    if status == 200 || status == 201
      {
        request_id: body["request_id"] || body["id"],
        status:     body["status"] || "processing"
      }
    else
      raise APIError.new(body["message"] || body["error"] || "Higgsfield API error", status)
    end
  end

  # === Polling de Status (compatível com padrão do treino) ===

  # Consulta o status de um job (treino OU geração)
  # @param request_id [String] UUID do job
  # @return [Hash] { status:, outputs:, soul_id:, error: }
  def request_status(request_id)
    body, status = get("/requests/#{request_id}/status")

    if status == 200
      {
        status:   body["status"],
        outputs:  body["outputs"] || [],
        soul_id:  body["soul_id"] || body["lora_id"] || body["model_id"],
        error:    body["error"]
      }
    else
      raise APIError.new(body["message"] || "Erro ao verificar status", status)
    end
  end

  # === Treino de Soul ID (migrado do TrainingController) ===

  # Submete imagens para treinar um novo Soul ID
  # @param images       [Array<String>] base64 strings (sem prefixo data:)
  # @param trigger_word [String] palavra gatilho para o modelo
  # @return [Hash] { request_id: }
  def train_soul(images:, trigger_word:)
    payload = {
      images:       images,
      trigger_word: trigger_word,
      prompt:       "a photo of #{trigger_word}"
    }

    body, status = post("/higgsfield-ai/soul/standard", payload)

    if status == 200 || status == 201
      { request_id: body["request_id"] }
    else
      raise APIError.new(body["message"] || body["error"] || "Higgsfield training error", status)
    end
  end

  private

  # === HTTP Helpers (espelhados do Wavespeed GenerateController) ===

  def auth_header
    "Key #{@api_key}:#{@api_secret}"
  end

  def build_http(uri, read_timeout: 60)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl      = true
    http.read_timeout = read_timeout
    http.verify_mode  = OpenSSL::SSL::VERIFY_PEER
    # Mesmo padrão do Wavespeed: desabilitar CRL checking
    store = OpenSSL::X509::Store.new
    store.set_default_paths
    store.flags = OpenSSL::X509::V_FLAG_CRL_CHECK_ALL ^ OpenSSL::X509::V_FLAG_CRL_CHECK_ALL
    http.cert_store = store
    http
  end

  def post(path, payload, read_timeout: 60)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = auth_header
    req["Content-Type"]  = "application/json"
    req.body = payload.to_json

    resp = http.request(req)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError.new("Higgsfield API timeout após #{read_timeout}s")
  end

  def get(path, read_timeout: 30)
    uri  = URI("#{HIGGSFIELD_BASE}#{path}")
    http = build_http(uri, read_timeout: read_timeout)

    req = Net::HTTP::Get.new(uri)
    req["Authorization"] = auth_header

    resp = http.request(req)
    [JSON.parse(resp.body), resp.code.to_i]
  rescue Net::ReadTimeout
    raise TimeoutError.new("Higgsfield API timeout após #{read_timeout}s")
  end
end
```

#### Passo 2.2: Refatorar `TrainingController` para usar o Service

Substituir as chamadas HTTP inline do `TrainingController` pelo `HiggsfieldService`:

- `submit_to_higgsfield` → `HiggsfieldService.new.train_soul(...)`
- `poll_higgsfield_status` → `HiggsfieldService.new.request_status(...)`
- `higgsfield_auth` → removido, encapsulado no service

**Benefício:** Um único ponto de manutenção para auth, SSL, timeouts e retry logic.

---

### FASE 3 — Criação do Controller de Geração Higgsfield

#### Passo 3.1: Criar/Estender Rotas

Adicionar em `backend/config/routes.rb`:

```ruby
# Higgsfield Soul 2.0 — Geração de imagens com Soul ID
post "generate/higgsfield",     to: "api/generate#create_higgsfield"
get  "generate/higgsfield/:id", to: "api/generate#higgsfield_status"
```

**Alternativa:** Criar um controller dedicado `Api::HiggsfieldController` se o GenerateController ficar muito grande. Recomendo estender o GenerateController primeiro (MVB — Minimum Viable Bloco), extrair depois se necessário.

#### Passo 3.2: Adicionar Actions no GenerateController

```ruby
# Dentro de Api::GenerateController

HIGGSFIELD_GENERATE_PATH = "/v1/soul/generate"  # a confirmar na Fase 1

def create_higgsfield
  model_id  = params[:model_id].to_s
  prompt    = params[:prompt].to_s.strip
  images    = Array(params[:images])
  seed      = params[:seed]

  # Validar model e soul_id
  model = current_user.avatar_models.find_by!(id: model_id)
  return render_error("Modelo não está pronto — Soul ID não encontrado", :unprocessable_entity) unless model.soul_id.present? && model.status == "ready"
  return render_error("Prompt é obrigatório") if prompt.blank?

  service = HiggsfieldService.new

  options = {}
  options[:images] = images if images.any?
  options[:seed]   = seed.to_i if seed.present? && seed.to_s != "-1"

  result = service.generate_image(soul_id: model.soul_id, prompt: prompt, **options)

  # Atualizar contador no model
  model.increment!(:images_generated)

  render json: { prediction_id: result[:request_id], status: result[:status] }
rescue HiggsfieldService::APIError => e
  render_error("Higgsfield API error: #{e.message}", :bad_gateway)
rescue HiggsfieldService::Error => e
  render_error(e.message, :service_unavailable)
rescue ActiveRecord::RecordNotFound
  render_error("Modelo não encontrado", :not_found)
end

def higgsfield_status
  prediction_id = params[:id]
  result = HiggsfieldService.new.request_status(prediction_id)

  render json: {
    status:  result[:status],
    outputs: result[:outputs] || [],
    error:   result[:error]
  }
rescue HiggsfieldService::APIError => e
  render_error("Erro ao verificar status: #{e.message}", :bad_gateway)
end
```

---

### FASE 4 — Frontend (TypeScript/React)

#### Passo 4.1: Adicionar métodos no API Client (`api.ts`)

```typescript
// Dentro de api.generate:
higgsfield: (data: {
  model_id: string;
  prompt: string;
  images?: string[];
  seed?: string;
}) =>
  request<{ prediction_id: string; status: string }>("/generate/higgsfield", {
    method: "POST",
    body: JSON.stringify(data),
  }),

higgsfieldStatus: (id: string) =>
  request<{ status: string; outputs: string[]; error?: string }>(
    `/generate/higgsfield/${id}`,
  ),
```

#### Passo 4.2: Criar/Adaptar Página de Geração com Soul ID

Criar `artifacts/area69/src/pages/GenerateHiggsfield.tsx` (ou estender `GenerateImage.tsx` com um seletor de modelo).

**Comportamento esperado:**
- Usuário seleciona um AvatarModel com status "ready" (tem soul_id)
- Insere prompt
- Opcional: imagens de referência (image-to-image)
- Geração custa créditos (a definir: 5-10 créditos por imagem)
- Polling a cada 2.5-3s, mesmo padrão Wavespeed
- Exibe "Higgsfield AI · Soul 2.0" no badge
- Exibe Soul ID usado na geração (primeiros 20 chars) para rastreabilidade

#### Passo 4.3: Atualizar Store e StoreContext (se necessário)

- `store.ts`: Adicionar `higgsfield` no tipo de geração se necessário
- `StoreContext.tsx`: Métodos para `generateHiggsfield` e polling

---

### FASE 5 — Testes (BMAD: Unit Tests Before Integration)

#### Passo 5.1: Testes Unitários do `HiggsfieldService`

Arquivo: `backend/test/services/higgsfield_service_test.rb`

**Casos de teste:**

```ruby
class HiggsfieldServiceTest < ActiveSupport::TestCase
  test "generate_image retorna request_id quando API responde 200"
  test "generate_image lança APIError quando API responde erro"
  test "generate_image lança Error quando ENVs não configurados"
  test "request_status retorna status e outputs quando completed"
  test "request_status extrai soul_id via fallback chain (lora_id → model_id → soul_id)"
  test "train_soul retorna request_id quando API responde 201"
  test "post lança TimeoutError após timeout"
end
```

#### Passo 5.2: Testes de Integração do Controller

Arquivo: `backend/test/controllers/api/generate_controller_higgsfield_test.rb`

**Casos de teste:**
- POST com model_id inválido → 404
- POST com model sem soul_id → 422
- POST com prompt vazio → 422
- POST com model de outro usuário → 404
- GET status com prediction_id válido → 200 + outputs
- GET status com prediction_id inválido → 502

---

### FASE 6 — Configuração de Ambiente (.env)

#### Passo 6.1: Variáveis de Ambiente Necessárias

```bash
# Higgsfield AI — Auth (já existente para treino)
HIGGSFIELD_API_KEY=<sua_api_key>
HIGGSFIELD_API_SECRET=<sua_api_secret>

# Wavespeed (já existente, referência)
WAVESPEED_API_KEY=<sua_wavespeed_key>
```

**Nota:** `HIGGSFIELD_API_KEY` e `HIGGSFIELD_API_SECRET` são lidos via `ENV.fetch`. Ambos já são usados pelo TrainingController. O HiggsfieldService usa as mesmas variáveis.

---

## 4. Diagrama de Arquitetura Final

```
┌──────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                       │
│  GenerateImage.tsx     GenerateHiggsfield.tsx (NOVO)         │
│  api.generate.image()  api.generate.higgsfield() (NOVO)      │
│  polling 2.5s          polling 2.5s                          │
└────────────┬────────────────────┬────────────────────────────┘
             │                    │
             ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│              BACKEND — GenerateController                     │
│                                                              │
│  create_image / image_status   → Wavespeed (existente)       │
│  create_video / video_status   → Wavespeed (existente)       │
│  create_higgsfield /           → HiggsfieldService (NOVO)    │
│  higgsfield_status                                          │
└────────────┬────────────────────┬────────────────────────────┘
             │                    │
             ▼                    ▼
┌────────────────────┐  ┌──────────────────────────────────────┐
│  Wavespeed API     │  │  HiggsfieldService (NOVO)            │
│  (inline HTTP)     │  │                                      │
│  Bearer token      │  │  generate_image(soul_id, prompt)     │
│  api.wavespeed.ai  │  │  request_status(request_id)          │
│                    │  │  train_soul(images, trigger_word)    │
│                    │  │                                      │
│                    │  │  Auth: Key <key>:<secret>            │
│                    │  │  SSL: VERIFY_PEER (CRL disabled)     │
│                    │  │  Base: platform.higgsfield.ai        │
└────────────────────┘  └──────────────────────────────────────┘
```

---

## 5. Matriz de Consistência: Wavespeed x Higgsfield

| Aspecto | Wavespeed | Higgsfield |
|---|---|---|
| **Serviço dedicado** | Não (inline) | SIM — `HiggsfieldService` |
| **Auth** | `Bearer <key>` | `Key <key>:<secret>` |
| **SSL** | VERIFY_PEER | VERIFY_PEER (corrigido de VERIFY_NONE) |
| **POST action** | `create_image` | `create_higgsfield` |
| **GET action** | `image_status` | `higgsfield_status` |
| **Rota POST** | `/api/generate/image` | `/api/generate/higgsfield` |
| **Rota GET** | `/api/generate/image/:id` | `/api/generate/higgsfield/:id` |
| **Response create** | `{ prediction_id, status }` | `{ prediction_id, status }` |
| **Response status** | `{ status, outputs, error }` | `{ status, outputs, error }` |
| **Frontend método** | `api.generate.image()` | `api.generate.higgsfield()` |
| **Frontend poll** | `api.generate.imageStatus()` | `api.generate.higgsfieldStatus()` |
| **Parâmetro extra** | `aspect_ratio`, `resolution` | `model_id` (para buscar soul_id) |
| **Créditos** | 5 (imagem) / 30 (vídeo) | 5-10 (a definir) |

---

## 6. Pontos de Atenção (Risk Register)

| Risco | Mitigação |
|---|---|
| **Endpoint real diferente do esperado** | Fase 1 — cURL manual de validação ANTES de codar |
| **Formato de auth diferente para geração** | Confirmar na Fase 1; o service suporta troca fácil |
| **Soul ID inválido/expirado na Higgsfield** | Tratar erro da API e retornar mensagem amigável |
| **Race condition no Thread.new** | Migrar para ActiveJob em refatoração futura (fora do escopo) |
| **SSL VERIFY_NONE no treino (vulnerabilidade)** | Corrigido no service novo para VERIFY_PEER |
| **Créditos cobrados sem imagem gerada** | Só deduzir créditos APÓS confirmar que o job foi aceito (200) |

---

## 7. Sequência de Execução (Ordem Cronológica)

| Ordem | Fase | Atividade | Entregável |
|---|---|---|---|
| 1 | Fase 1 | Validar endpoint Higgsfield via cURL | Documento com response shape real |
| 2 | Fase 2 | Criar `HiggsfieldService` com `generate_image`, `request_status`, `train_soul` | `backend/app/services/higgsfield_service.rb` |
| 3 | Fase 5 | Escrever testes unitários do Service | `backend/test/services/higgsfield_service_test.rb` |
| 4 | Fase 2 | Refatorar `TrainingController` para usar o Service | `training_controller.rb` atualizado |
| 5 | Fase 3 | Adicionar rotas e actions no `GenerateController` | Rotas + `create_higgsfield` + `higgsfield_status` |
| 6 | Fase 5 | Escrever testes de integração do Controller | `backend/test/controllers/api/generate_controller_higgsfield_test.rb` |
| 7 | Fase 4 | Adicionar métodos no `api.ts` | `api.generate.higgsfield()` + `higgsfieldStatus()` |
| 8 | Fase 4 | Criar página `GenerateHiggsfield.tsx` | UI de geração com Soul ID |
| 9 | Fase 6 | Validar `.env` com as variáveis necessárias | Documentação de deploy |
| 10 | — | Teste end-to-end: treinar → gerar | 1 fluxo completo funcional |

---

## 8. Aprovação

- [ ] Endpoint Higgsfield validado via cURL
- [ ] Service Object aprovado em code review
- [ ] Testes passando (`rails test`)
- [ ] Fluxo E2E funcional (treino → soul_id → geração → imagem no browser)
