# Vértice Performance

Plataforma de gestão e acompanhamento de atletas de base para clubes: ficha técnica, física e
mental, score do atleta, escalação e jogos, agenda, financeiro (cobranças, inadimplência, caixa) e
comissão técnica. Cada clube é um cliente (SaaS) com período de teste e licença; o dono da
plataforma tem uma área própria de administração.

Next.js 16 (App Router), React 19, Tailwind CSS 4, Supabase (Auth, Postgres com RLS, Storage),
Zod 4 e Vitest. Interface em português do Brasil.

> Esta versão do Next.js tem mudanças em relação ao que costuma estar nos tutoriais
> (`proxy.ts` no lugar de `middleware`, `params` e `searchParams` são Promises, entre outras).
> Antes de mexer em algo que usa API do Next, leia o guia em `node_modules/next/dist/docs/`.
> Veja também `AGENTS.md`.

## Como rodar

Requisitos: Node.js 20 ou superior e um projeto Supabase.

```bash
npm install
cp .env.example .env.local   # preencha ao menos as variáveis do Supabase
npm run dev                  # http://localhost:3000
```

Banco: as migrações estão em `supabase/migrations/`, em ordem numérica. Aplique-as no projeto
Supabase (`supabase db push` ou pelo editor SQL).

## Testes e verificação

```bash
npm test                     # Vitest (lógica pura e ações com dependências simuladas)
npx tsc --noEmit             # tipos
npm run lint                 # ESLint
```

## Variáveis de ambiente

Todas estão documentadas, uma a uma e com indicação de obrigatória ou opcional, em
[`.env.example`](.env.example). As indispensáveis para subir o app são `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Nunca versione valores.

## Administração da plataforma

A área `/admin` (clubes, receita, auditoria, segurança) é restrita ao e-mail definido em
`PLATFORM_ADMIN_EMAILS`. Como configurar, o modelo de segurança, as migrações pendentes e como
reverter: [`docs/ADMIN.md`](docs/ADMIN.md).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `app/(coach)`, `app/(staff)`, `app/(athlete)` | Telas por papel dentro de um clube |
| `app/(admin)` | Administração da plataforma (`/admin`) |
| `app/api` | Rotas de cron e webhooks do Asaas |
| `components/` | Componentes React; `components/ui` são os blocos de base |
| `lib/actions` | Server actions |
| `lib/platform` | Licença, contratos, auditoria e acesso do administrador |
| `lib/supabase` | Clientes do Supabase (sessão, serviço e navegador) |
| `supabase/migrations` | Esquema do banco |
| `scripts/` | Utilitários de linha de comando (cadastro de clube, sementes, verificações) |
