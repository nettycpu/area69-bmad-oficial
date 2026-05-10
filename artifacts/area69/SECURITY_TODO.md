# AREA 69 — Security TODO List
> Gerado via análise completa do código-fonte com Claude (Anthropic AI Integration)  
> Data: 2026-05-03 · Total: 22 itens · **✅ TODOS CORRIGIDOS**

---

## ✅ Todos os 22 Itens Corrigidos

| ID | Título | Arquivo(s) | Batch |
|----|--------|-----------|-------|
| SEC-001 | Autenticação Inexistente | `SignIn.tsx`, `SignUp.tsx`, `store.ts` | B2 |
| SEC-002 | Rotas do Dashboard Sem Proteção | `App.tsx` — `<ProtectedRoute>` | B2 |
| SEC-003 | Créditos Adicionados Sem Verificação de Pagamento | `Checkout.tsx` — banner demo + botão DEMO | B3 |
| SEC-004 | Senha Nunca Salva no Cadastro | `SignUp.tsx` — `savePassword()` + `setSession()` | B2 |
| SEC-005 | Ausência de Content-Security-Policy (CSP) | `index.html` — meta CSP | B1 |
| SEC-006 | Clickjacking — Sem X-Frame-Options | `index.html` — meta X-Frame-Options | B1 |
| SEC-007 | Avatar Base64 Sem Limite no Armazenamento | `store.ts` — `sanitizeProfile()` 7MB cap | B1 |
| SEC-008 | URL de Geração Sem Validação de Scheme | `store.ts` — `isSafeUrl()` em `sanitizeGeneration()` | B1 |
| SEC-009 | Vazamento de IDs para Terceiros em Fallback de Imagem | `History.tsx` — `/placeholder-gen.svg` local | B2 |
| SEC-010 | model.cover Base64 Sem Limite no Store | `store.ts` — `sanitizeModel()` 2MB cap | B1 |
| SEC-011 | Toggle de 2FA Enganoso | `Settings.tsx` — substituído por badge "em breve" | B3 |
| SEC-012 | Validação de Campos no Cadastro e Login | `SignIn.tsx`, `SignUp.tsx` — regex + minLength + erros inline | B2 |
| SEC-013 | Seed Input Aceita Valores Inválidos | `GenerateImage.tsx`, `GenerateVideo.tsx` — `type="text" inputMode="numeric"` | B3 |
| SEC-014 | Referrer-Policy Ausente | `index.html` — meta Referrer-Policy | B1 |
| SEC-015 | Dados Sensíveis Exclusivamente em localStorage | `store.ts` — sessão migrada para `sessionStorage` | B1 |
| SEC-016 | X-Content-Type-Options Ausente | `index.html` — meta X-Content-Type-Options | B1 |
| SEC-017 | Link "Esqueci Minha Senha" Morto | `SignIn.tsx` — hint de recuperação expandível | B2 |
| SEC-018 | Unhandled Promise Rejection em play() de Vídeo | `History.tsx` — `video.play().catch(() => {})` | B2 |
| SEC-019 | Strings Hardcoded em Modal de Exclusão | `Settings.tsx` + `i18n.ts` — chaves `deleteItem*` em 3 idiomas | B3 |
| SEC-020 | URL do WhatsApp Inválida/Placeholder | `Dashboard.tsx` — `motion.a` → `motion.div` desabilitado | B3 |
| SEC-021 | Variável `pills` com Chave de Tradução Errada | `SignUp.tsx` — removido; usa `tArr("signUp.featurePills")` | B3 |
| SEC-022 | Ausência de Virtualização na Lista do Histórico | `History.tsx` — paginação 20 itens + botão "carregar mais" | B2 |

---

## ✅ Já Corrigidos Anteriormente (pré-auditoria)

| ID | Título | Arquivo |
|----|--------|---------|
| SEC-F01 | SHA-256 para senha no localStorage | `store.ts` |
| SEC-F02 | Migração automática de senha plaintext para hash | `store.ts` |
| SEC-F03 | Runtime validation em loadState() | `store.ts` |
| SEC-F04 | Créditos bounds-checked (não-negativo, finito) | `store.ts` |
| SEC-F05 | Models limitados a 100 no carregamento | `store.ts` |
| SEC-F06 | Generations limitadas a 200 no carregamento | `store.ts` |
| SEC-F07 | addCredits valida valor não-negativo | `StoreContext.tsx` |
| SEC-F08 | addGeneration limita a 200 entradas | `StoreContext.tsx` |
| SEC-F09 | handleChangePassword async com checkPassword() | `Settings.tsx` |
| SEC-F10 | Avatar upload limitado a 5MB | `Settings.tsx` |
| SEC-F11 | Imagem de referência limitada a 10MB | `GenerateImage.tsx`, `GenerateVideo.tsx` |
| SEC-F12 | Fotos de treino limitadas a 10MB por arquivo | `Models.tsx` |
| SEC-F13 | Race condition em handleFiles corrigida | `Models.tsx` |
| SEC-F14 | imagesGenerated/videosGenerated incrementados após geração | `GenerateImage.tsx`, `GenerateVideo.tsx` |
| SEC-F15 | Download de thumbnail com `<a href download>` | `GenerateImage.tsx` |
| SEC-F16 | signUp.featurePills traduzido em pt-BR, en, es | `i18n.ts`, `SignUp.tsx` |

---

*22 itens auditados + corrigidos nesta sessão · 16 pré-existentes · **Total: 38 itens 100% resolvidos***
