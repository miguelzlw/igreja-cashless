# ⛪ Sistema Cashless para Eventos (Igreja)

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-PaaS-orange?style=for-the-badge&logo=firebase)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-blue?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-Linguagem-blue?style=for-the-badge&logo=typescript)

Um sistema completo e profissional de gestão de vendas e recargas focado em grandes eventos sociais e paroquiais. Projetado para substituir o papel por uma solução digital segura, rápida e intuitiva.

---

## 🚀 Funcionalidades Principais

### 💳 Sistema de Pagamento & Saldo
- **Recarga em Tempo Real**: Participants podem carregar saldo via PIX ou dinheiro diretamente nos caixas.
- **Transações Atômicas**: Segurança total no processamento financeiro com `Firebase runTransaction`, evitando perdas ou duplicidade.
- **Histórico Transparente**: Usuário acompanha cada gasto e recarga instantaneamente.

### 🏠 Modos de Operação
- **Vendedor (PDV)**: Interface otimizada com grade de produtos, carrinho dinâmico e escaneamento de QR Code para cobrança veloz.
- **Caixa de Recarga**: Ferramenta rápida para buscar usuários e injetar créditos.
- **Gerente de Barraca**: Dashboard de faturamento em tempo real, gestão de estoque e controle de equipe.
- **Admin Geral**: Controle macro da festa, criação de barracas e atribuição de cargos.

### 🎫 Fichas Físicas (Inclusão Digital)
- Geração de **Contas Temporárias** com QR Code para quem não possui smartphone ou prefere o método tradicional.
- Layout de impressão otimizado (6 fichas por folha A4) autogerado pelo sistema.

---

## 🎨 Design System
O projeto utiliza uma estética **Glassmorphism** premium, focada em:
- **Responsividade Total**: Experiência fluida em qualquer smartphone.
- **Micro-animações**: Feedback visual constante (Framer Motion).
- **Dark/Light Mode**: Adaptável à preferência do usuário ou luz ambiente do evento.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end**: React 19 + Next.js 15 (App Router).
- **Estilização**: Tailwind CSS para um design sob medida.
- **Backend / Infra**: 
  - **Firestore**: Banco de dados NoSQL em tempo real.
  - **Cloud Auth**: Autenticação segura via Google/E-mail.
  - **Security Rules**: Proteção granular de dados baseada em Roles.
- **Ferramentas**: Lucide React (Ícones), Local QR Generation, PWA/Service Workers.

---

## 🔧 Como Iniciar

1. Clone o repositório:
   ```bash
   git clone https://github.com/miguelzlw/igreja-cashless.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o `.env.local`:
   Crie o arquivo baseado no `.env.local.example` com suas chaves do Firebase.
4. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 👨‍💻 Desenvolvedor
**Miguel ZLW** - *Foco em soluções inovadoras e seguras.*

---

> [!NOTE]
> Este é um projeto de alta complexidade técnica que demonstra habilidades em arquitetura de software, segurança de dados e experiência do usuário (UX).
