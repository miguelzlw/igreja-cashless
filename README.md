# ⛪ Sistema Cashless para Eventos (Igreja)

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-PaaS-orange?style=for-the-badge&logo=firebase)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-blue?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-Linguagem-blue?style=for-the-badge&logo=typescript)

Sistema completo de vendas e recargas para grandes eventos paroquiais. Substitui o papel por uma solução digital com QR Code, PIX e fichas físicas para quem não tem smartphone.

---

## 🚀 Funcionalidades

- **PIX em tempo real** (integração Asaas) — usuário gera, paga, saldo é creditado automaticamente via webhook + Cloud Function atômica.
- **Recarga em dinheiro pelo Caixa** — operador escaneia QR do cliente e injeta o valor.
- **Fichas físicas com QR** — códigos sequenciais (sem duplicatas) impressos 6 por folha A4 para quem não tem celular.
- **PDV do Vendedor** — grid de produtos, carrinho, scan do QR do cliente, débito atômico.
- **Painel do Gerente** — cardápio, equipe, relatório de vendas da barraca.
- **Admin Geral** — barracas, usuários, cargos, relatório consolidado.
- **Modo Desenvolvedor** — uma única conta acessa todos os 5 painéis para testes (`/dev`).
- **Transações 100% atômicas** via `runTransaction` do Firestore — zero possibilidade de double-spend ou crédito duplicado.

---

## 🛠️ Stack

- **Front:** Next.js 16 (App Router) + React 19 + TailwindCSS
- **Auth & DB:** Firebase Auth + Firestore (regras granulares por role)
- **Backend pesado:** Cloud Functions (Node 20, região `southamerica-east1`)
- **PIX:** Asaas (sandbox e produção)
- **Testes:** Vitest + Testing Library

---

## 🔧 Setup do Zero

### 1. Pré-requisitos

- **Node.js 20+** e **npm**
- **Firebase CLI** (`npm i -g firebase-tools`)
- Conta no [Firebase](https://firebase.google.com)
- Conta no [Asaas](https://www.asaas.com) (use a sandbox em desenvolvimento)

### 2. Clonar e instalar

```bash
git clone https://github.com/miguelzlw/igreja-cashless.git
cd igreja-cashless
npm install
cd functions && npm install && cd ..
```

### 3. Criar projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com), clique em **Adicionar projeto**.
2. **Authentication** → habilite **E-mail/senha** e **Google**.
3. **Firestore Database** → criar banco no modo **produção**, região `southamerica-east1`.
4. **Cloud Functions** → habilite (precisa do plano Blaze, mesmo que vá usar dentro do free tier).
5. **Configurações do projeto → Geral**: copie o objeto `firebaseConfig`.

Depois, no terminal:

```bash
firebase login
firebase use --add   # selecione o projeto que você criou
```

### 4. Configurar `.env.local`

Copie o exemplo e preencha:

```bash
cp .env.local.example .env.local
```

Variáveis necessárias (todas estão comentadas no `.env.local.example`):

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Console → Configurações → Geral |
| `ASAAS_API_KEY` | Asaas → Integrações → API |
| `ASAAS_WEBHOOK_TOKEN` | Você define (string aleatória ≥32 chars) |
| `INTERNAL_WEBHOOK_SECRET` | Você define (string aleatória ≥32 chars) |
| `CREDIT_PIX_URL` | Firebase mostra após `firebase deploy --only functions:creditPixPayment` |

### 5. Configurar segredos das Cloud Functions

```bash
# Segredo do HMAC do QR (use uma string aleatória forte, ex.: openssl rand -hex 32)
firebase functions:secrets:set HMAC_SECRET

# Segredo compartilhado entre webhook (Next) e Cloud Function de crédito
# IMPORTANTE: usar o MESMO valor que está no .env.local
firebase functions:secrets:set INTERNAL_WEBHOOK_SECRET
```

### 6. Deploy de regras, índices e Cloud Functions

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

Anote a URL da função `creditPixPayment` que aparece no log e cole no `.env.local` em `CREDIT_PIX_URL`.

### 7. Configurar webhook no painel do Asaas

1. Asaas Dashboard → **Integrações → Webhooks** → **Adicionar webhook**.
2. URL: `https://SEU_DOMINIO/api/pix/webhook`.
3. Header **`asaas-access-token`** = o valor de `ASAAS_WEBHOOK_TOKEN`.
4. Eventos: **PAYMENT_RECEIVED** (mínimo).
5. Sandbox primeiro, produção depois.

### 8. Subir o app

```bash
npm run dev
```

Abre em `http://localhost:3000`.

### 9. Criar conta admin inicial

1. Cadastre-se normalmente em `/register` (você vira `user`).
2. Altere a role manualmente no Firestore Console: `users/{seu-uid}.role = "admin"`.
3. Faça logout/login para o app puxar a nova role.
4. A partir daí, você troca cargos pela UI em `/admin/usuarios`.

> Dica: para testar tudo, troque sua própria role para `desenvolvedor` em `/admin/usuarios`. Você ganha um Hub Dev em `/dev` com botões para entrar em qualquer painel.

---

## 🧪 Testes

```bash
npm test          # roda uma vez
npm run test:watch # modo watch
```

Cobertura atual:
- ✅ Helpers de formatação (`formatters.ts`)
- ✅ Contexto de impersonation do dev
- ⏳ **TODO** — testes de integração das Cloud Functions críticas (rechargeBalance, processPayment, processRefund, creditPixPayment) usando Firestore emulator.
- ⏳ **TODO** — teste de race condition do contador de fichas com 5 caixas simultâneos.

---

## 📦 Deploy em Produção

1. Crie um projeto Firebase separado para produção (ex.: `festa-saojoao-prod`).
2. Repita os passos 4–7 acima nesse projeto.
3. Use a **API key de PRODUÇÃO** do Asaas (não a sandbox).
4. Hospede o Next.js (Vercel é o caminho mais fácil) configurando todas as `NEXT_*`, `ASAAS_*`, `INTERNAL_WEBHOOK_SECRET` e `CREDIT_PIX_URL` como env vars do projeto.
5. **Antes do evento**: faça um teste end-to-end com um valor real pequeno (R$ 5) para confirmar que o webhook credita o saldo.

---

## 🐛 Troubleshooting

| Erro | Causa provável | Fix |
|---|---|---|
| `auth/configuration-not-found` | `.env.local` faltando ou errado | Verifique todos os `NEXT_PUBLIC_FIREBASE_*` |
| Webhook recebe 401 | `ASAAS_WEBHOOK_TOKEN` diferente do que tá no painel do Asaas | Igualar os dois |
| Webhook recebe 500 com "deferred" | `INTERNAL_WEBHOOK_SECRET` ou `CREDIT_PIX_URL` errado/faltando | Conferir env vars + secret na Cloud Function |
| `permission-denied` ao salvar venda | Vendedor sem `stall_id` | Vincular barraca em `/admin/usuarios` |
| Build local quebra em `functions/src/...` | Esqueceu `cd functions && npm install` | Instalar deps das Functions |

---

## 🗂️ Estrutura

```
src/app/(dashboard)/      Painéis por role (admin, caixa, gerente, vendedor, user, dev)
src/app/api/pix/          Rotas PIX (create, status, webhook → delegam para CF)
src/components/           UI compartilhada
src/lib/firebase/         Config + helpers do client SDK
src/lib/hooks/            useAuth, useDevImpersonation
firestore.rules           Regras de acesso por role
functions/src/            Cloud Functions (admin SDK)
  payment/                processPayment, rechargeBalance, processRefund, creditPixPayment
  auth/                   onUserCreate (cria userDoc)
  qr/                     generateQRCode
```

---

## 👨‍💻 Autor

**Miguel ZLW** · Sistema construído para a Festa de São João.
