# AGILIX — Gestão Inteligente

**AGILIX** é um sistema web completo de gestão empresarial (ERP) voltado para pequenas e médias empresas. Ele centraliza o controle de estoque, vendas, compras, financeiro, produção e cadastros em uma única plataforma moderna e intuitiva.

---

## 🧩 Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral do negócio com indicadores principais |
| **Estoque** | Controle de quantidades, ajustes manuais e movimentações |
| **Produtos** | Cadastro de matérias-primas e produtos acabados (SKU, preço, categoria) |
| **Vendas** | Registro de vendas, itens vendidos, descontos e formas de pagamento |
| **Compras** | Pedidos de compra com fornecedores, itens e controle de entrega |
| **Financeiro** | Contas a pagar e receber, categorias e status de pagamento |
| **Produção** | Ordens de fabricação vinculadas a produtos |
| **Cadastros** | Clientes e fornecedores com dados completos |
| **Custos/Precificação** | Análise de custos e formação de preços (somente admin) |
| **Relatórios** | Relatórios gerenciais (somente admin) |

## 🔐 Autenticação e Permissões

- Login por e-mail/senha via **Supabase Auth**
- Controle de acesso baseado em **roles** (`admin`, `staff`, `estoque`, `vendas`, `financeiro`)
- Páginas restritas a administradores (Relatórios e Custos)
- Convite de equipe com provisionamento automático

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Estilização | Tailwind CSS 3, shadcn/ui |
| Estado/Data | TanStack React Query, React Hook Form, Zod |
| Backend/BD | Supabase (PostgreSQL, Auth, Edge Functions, RLS) |
| Roteamento | React Router v6 |
| Gráficos | Recharts |

## 📁 Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis (UI, layout, inventory, auth, etc.)
├── hooks/            # Hooks customizados (useAuth, useIsAdmin, etc.)
├── integrations/     # Configuração do Supabase (client + tipos gerados)
├── lib/              # Utilitários (tratamento de erros, helpers)
├── pages/            # Páginas da aplicação (Dashboard, Estoque, Vendas, etc.)
├── types/            # Tipos TypeScript compartilhados
├── assets/           # Imagens e logos
└── main.tsx          # Ponto de entrada da aplicação

supabase/
├── functions/        # Edge Functions (keep-alive, provision-staff-user)
├── migrations/       # Migrações SQL do banco de dados
└── config.toml       # Configuração local do Supabase
```

## 🚀 Como rodar localmente

### Pré-requisitos
- **Node.js** 18+ e **npm** (ou bun)

### Passos

```bash
# 1. Clone o repositório
git clone <URL_DO_REPOSITÓRIO>
cd <NOME_DO_PROJETO>

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
# Crie um arquivo .env na raiz com:
#   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
#   VITE_SUPABASE_ANON_KEY=sua-anon-key

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:8080`.

## 🧪 Testes

```bash
npm run test
```

## 📦 Build para Produção

```bash
npm run build
```

Os arquivos finais serão gerados na pasta `dist/`.

---

## 📝 Resumo para IAs / IDEs com IA (Antigravity, Cursor, etc.)

> **Use este prompt para contextualizar a IA sobre o projeto:**

```
Este é o AGILIX, um sistema ERP web para pequenas e médias empresas.

Stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui.
Backend: Supabase (PostgreSQL com RLS, Auth, Edge Functions).
Estado: TanStack React Query para cache/fetch, React Hook Form + Zod para formulários.
Roteamento: React Router v6 com rotas protegidas por autenticação e roles.

Módulos: Dashboard, Estoque, Produtos, Vendas, Compras, Financeiro, Produção, Cadastros, Custos e Relatórios.

Convenções:
- Componentes em src/components/ organizados por domínio (inventory/, auth/, layout/, ui/).
- Páginas em src/pages/, cada uma corresponde a uma rota.
- Hooks customizados em src/hooks/ (useAuth para autenticação, useIsAdmin para verificar role).
- Tipos do Supabase gerados automaticamente em src/integrations/supabase/types.ts (não editar manualmente).
- Design system usa tokens semânticos CSS (HSL) definidos em src/index.css e tailwind.config.ts.
- Componentes UI são do shadcn/ui em src/components/ui/.
- Todas as queries ao banco usam o client Supabase de src/integrations/supabase/client.ts.
- RLS ativo em todas as tabelas. Roles armazenadas na tabela user_roles (nunca na tabela profiles).
- Variáveis de ambiente prefixadas com VITE_ para exposição ao frontend.

Ao fazer alterações, mantenha a arquitetura existente, use os tokens do design system (nunca cores hardcoded), e preserve a tipagem TypeScript.
```
