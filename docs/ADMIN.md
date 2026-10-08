# Administração da plataforma

Área de uso exclusivo do dono do Vértice: clientes (clubes), receita, plano padrão, trilha de
auditoria e segurança. Fica em `/admin` e é separada das telas de clube.

## Como ter acesso

1. **Crie a conta.** Entre em `/cadastro` (ou crie o usuário no painel do Supabase, em
   Authentication > Users) com o e-mail que será o administrador, e deixe-o **confirmado**.
   Faça isso **antes** de definir a variável do passo 2: enquanto o e-mail não é reservado,
   qualquer pessoa poderia cadastrá-lo.
2. **Defina `PLATFORM_ADMIN_EMAILS`.** Valor: o seu e-mail (vários, só se necessário, separados
   por vírgula).
   - Produção: Vercel > Project Settings > Environment Variables (ambiente Production).
   - Desenvolvimento: `.env.local` na raiz do projeto.
3. **Faça um novo deploy** na Vercel (variável nova só vale para deploys feitos depois dela) e
   reinicie o `npm run dev` localmente.
4. **Entre em `/login`** com esse e-mail e a senha. Você cai direto em `/admin`.

Não é preciso ter clube nem linha em `profiles`. Se o mesmo e-mail também for de um treinador, o
menu lateral ganha **Meu clube**, e o menu do treinador ganha **Administração**.

Para trocar de administrador ou revogar o acesso: edite a variável, faça novo deploy. Lista
vazia ou ausente significa que **ninguém** acessa.

## Modelo de segurança

| Decisão | Por quê |
| --- | --- |
| **Não é um papel no banco.** O acesso é a lista de e-mails em `PLATFORM_ADMIN_EMAILS`, lida só no servidor. | Um papel com policy de RLS que enxerga todos os clubes enfraqueceria o isolamento de todo o sistema para sempre; bastaria um engano numa consulta para vazar dados entre clubes. A área usa a service role no servidor e nenhuma policy nova. |
| **404 para estranhos.** Quem está logado fora da lista recebe a página "não encontrada", igual a qualquer endereço inexistente. | A área não revela que existe. Sem sessão, a pessoa vai para `/login`. |
| **Lista vazia bloqueia todos.** | Esquecer a variável não pode virar porta aberta a qualquer usuário logado. |
| **E-mail precisa estar confirmado** no Supabase Auth. | Sem isso, quem criasse a conta com o e-mail do dono antes dele herdaria o acesso. |
| **E-mail reservado.** Cadastro (`/cadastro`), convite de profissional, convite de atleta e resgate de link recusam os e-mails da lista com a mensagem neutra "E-mail indisponível." | Essas rotas criam contas já confirmadas; sem a recusa, alguém poderia se cadastrar com o e-mail do dono antes dele. |
| **Identidade validada no servidor.** O acesso usa `supabase.auth.getUser()`, que confere o token no Auth a cada requisição, e não só o cookie. | Cookie sozinho pode ser forjado ou estar revogado. |
| **Defesa em profundidade.** O layout barra, mas cada página e cada server action chamam `requirePlatformAdmin()` na primeira linha. | Layouts não são reexecutados ao navegar entre páginas irmãs, e uma server action é um endpoint POST que dispensa a página. |
| **Segundo fator opcional.** `PLATFORM_ADMIN_REQUIRE_MFA=true` exige senha + código do aplicativo autenticador (nível AAL2). A tela `/admin/seguranca` continua aberta sem o segundo fator, para a pessoa poder cadastrá-lo. | Desligado por padrão: nada muda para quem não ligar. Ligue só depois de cadastrar o aplicativo. |
| **Trilha imutável.** Toda ação do painel grava em `platform_audit_log` (quem, quando, IP, o que mudou "de → para"). Um gatilho no banco bloqueia `UPDATE` e `DELETE`. | Nem um erro no painel consegue reescrever o histórico. Nunca entram segredos (chaves, tokens, CPF/CNPJ). |
| **Sem cache offline.** O service worker não guarda nem serve páginas de `/admin`. | A área mostra o negócio inteiro e não pode ficar salva no aparelho. |

Limites a conhecer:

- Mantenha **Confirm email** ligado em Supabase > Authentication > Providers > Email. Com ele
  desligado, qualquer um poderia criar direto no Auth uma conta já confirmada com o e-mail do dono.
- Para o segundo fator funcionar, o projeto Supabase precisa ter o MFA por TOTP habilitado
  (Authentication > Sign In / Providers > Multi-Factor).
- O e-mail do administrador é, na prática, metade da credencial. Use uma senha forte e exclusiva e,
  de preferência, ligue o segundo fator.

## O que cada página faz

| Página | O que mostra |
| --- | --- |
| **Visão geral** `/admin` | Clubes, pagantes, em teste e receita recorrente (clubes de demonstração não contam), mais o funil de leads e a conversão. |
| **Clubes** `/admin/clubes` | Lista de clubes com busca por nome e filtro por situação (a URL guarda o filtro). Em cada clube: estender teste, cortesia, cota e preço próprios, situação, promessa de pagamento e cobrança recorrente no Asaas. |
| **Contratos** `/admin/contratos` | Página-reserva ("em construção nesta fase"); a fase de contratos a substitui. |
| **Saúde técnica** `/admin/saude` | Página-reserva; a fase de saúde técnica a substitui. |
| **Auditoria** `/admin/auditoria` | Trilha das ações do painel, 50 por página, mais novas primeiro; filtro por área/ação e por clube; horários de Brasília; mudanças em "de → para". |
| **Configurações** `/admin/configuracoes` | Plano padrão: nome, mensalidade, dias de teste, atletas por licença e retenção após cancelar. |
| **Segurança** `/admin/seguranca` | Quem tem acesso (e-mails mascarados), se a lista está configurada, nível da sessão atual, se o segundo fator é obrigatório e o cadastro do aplicativo autenticador (QR code, confirmação por código, listar e remover). |

`/plataforma` (endereço antigo) apenas redireciona para `/admin`.

Ações registradas na auditoria: `settings.update`, `club.extend_trial`, `club.grant_courtesy`,
`club.revoke_courtesy`, `club.reset_payment_promise`, `club.set_overrides`, `club.set_status`,
`club.start_subscription`, `club.cancel_subscription`. Salvar o plano ou as cotas sem mudar nada
não gera registro.

## Migrações 0072 a 0075

Estão em `supabase/migrations/` e **precisam ser aplicadas no banco** (por exemplo com
`supabase db push`, ou colando o SQL no editor do Supabase, na ordem).

| Migração | Cria | Usada por |
| --- | --- | --- |
| `0072_platform_audit_log.sql` | `platform_audit_log` (somente acréscimo, com gatilho que bloqueia `UPDATE`/`DELETE`) | Trilha de auditoria |
| `0073_club_contracts.sql` | `club_contracts`, bucket privado `club-contracts` e um contrato inicial para cada clube pagante | Contratos (próxima fase) |
| `0074_platform_telemetry.sql` | `system_events`, `web_vitals`, `cron_runs` e as funções `platform_error_groups`, `platform_error_daily`, `platform_vitals_summary`, `platform_prune_telemetry` | Saúde técnica (próxima fase) |
| `0075_platform_usage.sql` | Função `platform_club_usage()` (uso por clube) | Clubes e visão geral (próxima fase) |

### Enquanto não forem aplicadas

O código foi escrito para subir antes do SQL, sem quebrar:

- **Ações do painel funcionam normalmente.** Se a tabela de auditoria não existe, a gravação da
  trilha falha em silêncio para a pessoa e deixa um aviso no log do servidor
  (`[auditoria] tabela platform_audit_log ausente (migração 0072 pendente)`). Nesse período **as
  ações não ficam registradas**: aplique a 0072 antes de usar o painel para mudar preço ou
  situação de clube.
- **`/admin/auditoria`** mostra o aviso "Migração 0072 pendente" em vez de erro.
- As páginas das fases seguintes devem seguir o mesmo padrão (`isMissingRelation` em
  `lib/platform/contracts.ts` e o componente `MigrationNotice`).

## Como reverter

**Fechar o acesso na hora:** apague ou esvazie `PLATFORM_ADMIN_EMAILS` e faça novo deploy. A área
passa a responder 404 a todos. É o botão de emergência.

**Desfazer o código:** reverta os commits da fundação do módulo (`git revert`). `/plataforma`
volta a ser o painel antigo. Nenhum dado de clube é tocado por esse código.

**Desfazer as migrações** (somente se necessário; apaga o que foi gravado nelas, inclusive a
trilha de auditoria):

```sql
-- 0075
drop function if exists public.platform_club_usage();

-- 0074
drop function if exists public.platform_error_groups(timestamptz);
drop function if exists public.platform_error_daily(integer);
drop function if exists public.platform_vitals_summary(timestamptz);
drop function if exists public.platform_prune_telemetry(integer);
drop table if exists system_events, web_vitals, cron_runs;

-- 0073 (o bucket só pode ser removido vazio)
drop table if exists club_contracts;
delete from storage.buckets where id = 'club-contracts';

-- 0072
drop table if exists platform_audit_log;
drop function if exists public.platform_audit_log_immutable();
```

Se o repositório de migrações do Supabase estiver sincronizado, remova também o registro das
versões 0072 a 0075 da tabela de histórico para poder reaplicá-las depois.

## Para quem for criar novas telas

- Toda página nova em `app/(admin)/admin/` chama `await requirePlatformAdmin()` na primeira
  linha, e toda server action também (de `lib/platform/admin.ts`).
- Ações que alteram algo chamam `await logPlatformAction({ action, club, details })`
  (`lib/platform/audit.ts`) **depois** da mutação. Para mudanças, `details: { changes:
  diffFields(antes, depois) }`. Nunca coloque segredo nos detalhes. Dê rótulo em português à ação
  nova em `lib/platform/auditLabels.ts`.
- Depois de mutar, chame `revalidateAdmin()` (`lib/platform/revalidate.ts`).
- Tabelas das migrações 0072 a 0075 podem não existir: trate com `isMissingRelation`.
