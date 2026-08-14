# SPEC de funcionalidade — `SPEC-023 — Deploy pessoal de produção no Railway e distribuição Android`

> Esta unidade é exclusivamente documental. Ela aprova o contrato de uma implementação futura separada; não cria infraestrutura, configuração Railway, Dockerfile, script de produção, secret, migration, APK, keystore, bucket, domínio, workflow ou cobrança.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-023` |
| Título | Deploy pessoal de produção no Railway e distribuição Android |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-14 |
| Última atualização | 2026-08-14 |
| Tarefa relacionada | Prompt DOC-SPEC-023 no Codex Cloud |
| Documentos relacionados | SPEC-002, SPEC-012, SPEC-015, SPEC-020 e SPEC-022; fluxo Git; Definition of Done; estratégia de testes |

## 2. Status e aprovação

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-14`, ao pedir expressamente “criar e aprovar” a SPEC e fornecer as decisões obrigatórias.

A aprovação fixa arquitetura, limites e aceite, mas **não autoriza deploy nem contratação**. Cada fase de implementação requer unidade própria, revisão do estado vigente das plataformas e autorização humana para ativar serviço pago ou publicar em PRD. Dependências de validação abaixo são provas técnicas da implementação, não escolhas silenciosamente delegadas.

## 3. Contexto e pesquisa oficial

O PlannerFin é um monorepo `pnpm` com SPA Vue 3/Quasar/Capacitor compartilhada por Web e Android, API NestJS e PostgreSQL/Prisma. Railway detectou `@planner-fin/web` e `@planner-fin/api`, mas a detecção, isoladamente, não constitui configuração de produção; em particular, foi observado o comando Web de desenvolvimento.

Pesquisa oficial consultada em `2026-08-14`:

- Railway: [monorepos](https://docs.railway.com/deployments/monorepo), [autodeploy pelo GitHub](https://docs.railway.com/deployments/github-autodeploys), [pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command), [healthchecks](https://docs.railway.com/deployments/healthchecks) e [restart policy](https://docs.railway.com/deployments/restart-policy);
- Railway: [rede pública e SSL](https://docs.railway.com/networking/public-networking), [variáveis e sealed variables](https://docs.railway.com/variables), [PostgreSQL](https://docs.railway.com/databases/postgresql) e [backups de volumes](https://docs.railway.com/volumes/backups);
- Railway: [planos](https://docs.railway.com/pricing/plans), [controle de custos](https://docs.railway.com/pricing/cost-control), [logs](https://docs.railway.com/observability/logs) e [métricas](https://docs.railway.com/observability/metrics);
- Railway: [Storage Buckets](https://docs.railway.com/storage-buckets), [upload/serving](https://docs.railway.com/storage-buckets/uploading-serving) e [billing](https://docs.railway.com/storage-buckets/billing);
- Android: [assinatura de apps](https://developer.android.com/studio/publish/app-signing), [ADB/instalação](https://developer.android.com/tools/adb) e [developer verification](https://developer.android.com/developer-verification).

Fatos externos relevantes: Railway oferece domínio próprio da plataforma e SSL automático; healthcheck decide a promoção inicial, mas não monitora continuamente; PostgreSQL nasce privado e só se torna público por ação explícita; buckets são privados, S3-compatible e não fornecem bucket público, usando URL pré-assinada ou proxy; limites e preços podem mudar. A implementação deve reauditar essas páginas na data do go-live, principalmente plano, retenção, developer verification e regras de sideload.

## 4. Problema

O estado local validado não define uma trilha reproduzível, segura e economicamente limitada para PRD. O start Web atual usa Vite dev; a API não lê diretamente o `PORT` fornecido pelo Railway; o healthcheck não comprova banco; não há serving estático de produção, política de migration/deploy/rollback, backup restaurável ou release Android de produção. Distribuir um APK sem chave durável, checksum, versão e origem PRD impediria atualizações confiáveis e ampliaria o risco de supply chain.

## 5. Objetivos

1. Definir PRD pessoal no Railway com Web, API e PostgreSQL isolados por serviço.
2. Definir deploy automático de Web/API a partir de `main`, com migrations únicas e promoção bloqueada por saúde.
3. Definir autenticação Web e Android em hosts distintos sem wildcard, vazamento de segredo ou dependência de host hardcoded.
4. Definir build Android release assinado, disparado somente por tag/release, e distribuição privada verificável por link.
5. Definir operação, backup/restore, rollback, custo e critérios de aceite antes de qualquer ativação.

## 6. Não objetivos e arquivos fora do escopo desta unidade

- implementar ou alterar código, infraestrutura, Railway, Dockerfile, Nixpacks/Railpack, scripts, secrets, migrations, CI/GitHub Actions, APK, keystore, bucket ou domínio;
- comprar domínio, assinar plano, ativar pagamento, publicar em produção, Play Store ou outra loja;
- auto-update silencioso, atualização forçada ou instalação remota;
- alta disponibilidade multi-região, staging permanente, CDN, WAF, observabilidade paga ou escala horizontal na V1;
- seed, dados sintéticos ou migração de dados reais nesta unidade;
- aconselhamento financeiro ou funcionalidade bancária regulada.

Somente `docs/specs/SPEC-023-DEPLOY-PRD-RAILWAY-ANDROID.md` e o índice `docs/specs/README.md` podem ser alterados nesta unidade documental.

## 7. Termos e atores

| Termo/ator | Definição ou responsabilidade |
|---|---|
| PRD | Ambiente pessoal de produção, separado de desenvolvimento/teste. |
| Operador | Dono autorizado do projeto Railway, secrets, backups e releases. |
| Tester confiável | Pessoa que recebe link privado e decide instalar o APK por sideload. |
| Deploy Web/API | Artefato de um commit de `main`; não inclui APK. |
| Release Android | Artefato de tag SemVer, assinado pela chave estável de produção. |
| Rollback | Retorno compatível do código/artefato; não significa desfazer migration destrutiva. |
| Alias `latest` | Referência estável à release Android aprovada mais recente, nunca um artefato sem versão. |

## 8. Auditoria AS-IS confirmada

| Área | Evidência atual | Lacuna para PRD |
|---|---|---|
| Workspace | Raiz exige Node `>=22`, pnpm `10.28.1`; build usa `pnpm -r build`. | Railway precisa instalar workspace completo e cache/lockfile reproduzível. |
| Web | `dev` executa `vite --host 0.0.0.0 --port 9000`; `build` produz `dist` via Vite. | Não existe start/servidor estático de PRD nem fallback SPA aprovado. Vite dev é proibido. |
| API | Existe `build: nest build`, mas não existe script `start` de produção. | Definir start do `dist`, sem watcher e sem compilar na inicialização. |
| Porta/bind | API lê `API_PORT` (default 3000) e `API_HOST`; Railway healthcheck usa `PORT`. | Implementação deve aceitar `PORT`, bind `0.0.0.0` e falhar com configuração inválida. |
| Health | `GET /api/health` retorna contrato estático `{status, service}`. | Serve como liveness, mas não readiness de DB. É necessário contrato de readiness seguro. |
| Shutdown | Nest usa `enableShutdownHooks()` e encerra bootstrap com código 1 em erro. | Validar SIGTERM, fechamento HTTP/Prisma e prazo da plataforma. |
| DB | Prisma usa somente `DATABASE_URL`; API oferece `db:migrate = prisma migrate deploy`. | Não há execução orquestrada uma vez, backup agendado nem restore drill. |
| Env API | Nomes reais: `DATABASE_URL`, `API_PORT`, `API_HOST`, `API_CORS_ORIGINS` (legado singular aceito), `JWT_SECRET`, `REFRESH_HMAC_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `COOKIE_SECURE`. | `NODE_ENV` e Railway `PORT` precisam integrar o guard/config de PRD; nunca criar aliases desnecessários. |
| Env Web | `VITE_API_BASE_URL`, embutida no build; fallback atual aponta a localhost. | Build PRD deve exigir URL HTTPS explícita e nunca aceitar fallback local. |
| Auth/CORS | CORS usa allowlist explícita e `credentials:true`; refresh e CSRF são cookies; CSRF valida cookie, header e Origin. Web usa `credentials:'include'`. Android é reconhecido por Origin `https://localhost`. | Provar política SameSite/Secure nos hosts Railway reais e no WebView; wildcard continua proibido. |
| Tokens | Access token em memória; refresh `HttpOnly`; CSRF legível. Segredos JWT/HMAC precisam ser independentes e fortes. | Preservar modelo; nenhum secret no bundle Web/Android. |
| Android | `applicationId com.plannerfin.app`; package Web `0.1.0`; `versionCode=1`; variante `internal` usa quatro envs de signing e gera APK nomeado. | Não há variante/release de produção explicitamente publicada, incremento automático validado, metadata/checksum ou pipeline por tag. |
| Signing atual | Nomes reais: `PLANNER_FIN_KEYSTORE_FILE`, `PLANNER_FIN_KEYSTORE_PASSWORD`, `PLANNER_FIN_KEY_ALIAS`, `PLANNER_FIN_KEY_PASSWORD`. | Arquivo e senhas devem residir fora do Git, com backup e acesso mínimo. |
| Android API | `VITE_API_BASE_URL` deve ser HTTPS e terminar em `/api` fora de debug. | Release deve gravar URL PRD, sem localhost/LAN/mkcert. |
| DX local | Existem referências deliberadas a localhost, `10.0.2.2`, `192.168.*`, mkcert/proxy e seed local. | Continuam válidas só em dev/teste e são rejeitadas por gates de PRD. |
| Deploy | Não existem configuração Railway/CI ou política de autodeploy no repositório. | A detecção automática atual é rascunho não aprovado para go-live. |

`DEV-AUTH` não foi encontrado como mecanismo de autenticação no código auditado. Ainda assim, a implementação deve criar guard negativo contra qualquer flag/rota/middleware equivalente em `NODE_ENV=production`; o seed local já contém recusa para `NODE_ENV=production`, que deve ser preservada e testada.

## 9. Arquitetura PRD TO-BE

```text
                              merge/push main
                                    |
                        +-----------+-----------+
                        |                       |
Internet --HTTPS--> Web Railway          API Railway <--HTTPS-- Android release
                  SPA estática             |  /api/health
                        |                   |  rede privada
                        +--HTTPS/CORS------>|       |
                                             PostgreSQL Railway

tag v0.x.y --> build Android separado --> APK assinado + SHA-256 + metadata
                                             |
                                  Railway Bucket (condicional)
                                             |
                                endpoint/link estável controlado
```

### 9.1 Topologia escolhida e justificativa

- Um projeto/ambiente Railway `production`, com serviços `web`, `api` e `postgres`; bucket `android-releases` somente após a auditoria da Fase E.
- Web e API têm domínios públicos independentes. PostgreSQL não recebe Public Access/TCP Proxy. API usa a referência privada `DATABASE_URL`, nunca `DATABASE_PUBLIC_URL`.
- Hosts distintos foram escolhidos porque preservam serviços independentes, healthcheck/rollback próprios e a API pública necessária ao Android, sem introduzir um reverse proxy como novo ponto único. O custo é CORS/cookies mais sensíveis, cobertos por testes obrigatórios.
- Mesma origem via reverse proxy simplificaria cookies e CORS, mas duplicaria roteamento, poderia ocultar a API necessária ao Android e adicionaria acoplamento operacional não presente. Fica adiada; só poderá substituir a topologia por revisão desta SPEC/ADR.

### 9.2 Monorepo e fronteiras de build

Cada serviço aponta ao mesmo repositório e branch `main`, com contexto na raiz para resolver workspaces compartilhados. Build/start são definidos por serviço e nunca confiados cegamente à autodetecção. Watch paths devem incluir o app, `packages/shared`, `packages/config`, lockfile, workspace e configurações raiz relevantes; mudança compartilhada redeploya ambos. Alteração apenas documental ou Android nativo não deve, quando a plataforma permitir, consumir deploy Web/API.

## 10. Serviços Railway, domínios e HTTPS

| Serviço | Exposição | Domínio lógico | Requisito |
|---|---|---|---|
| Web | Pública HTTPS | `WEB_PUBLIC_ORIGIN` conceitual, valor futuro `https://<web>.up.railway.app` | SSL automático, redirect HTTP→HTTPS quando aplicável, SPA fallback. |
| API | Pública HTTPS | base futura `https://<api>.up.railway.app/api` | Sem URL real hardcoded; health em `/api/health`. |
| PostgreSQL | Somente rede privada | referência Railway em `DATABASE_URL` | Sem domínio/TCP público. |
| Bucket | Privado/condicional | objetos S3 privados | Acesso por endpoint controlado ou URL pré-assinada; credenciais nunca no cliente. |

V1 não compra domínio. Railway `*.up.railway.app` e SSL automático são baseline. `VITE_API_BASE_URL` é configurada por ambiente no build Web e Android. Uma troca futura para custom domain altera apenas configuração, allowlist e emissão de artefatos, não código de negócio. O valor público Web entra em `API_CORS_ORIGINS`; não se inventa variável `WEB_PUBLIC_ORIGIN` até a implementação comprovar necessidade — o nome acima é apenas conceito documental.

## 11. Deploy Web e API

### 11.1 Web

- Build de produção: instalação frozen do lockfile e `pnpm --filter @planner-fin/web build`, incluindo build prévio dos workspaces exigidos.
- Serving: servidor HTTP estático de produção mantido no processo Railway, servindo `apps/web/dist`, assets com cache por hash e `index.html` sem cache longo.
- Toda rota não-arquivo válida da SPA retorna `index.html`; `/assets/*` inexistente retorna 404 e não HTML.
- O servidor escuta `0.0.0.0:$PORT`, responde ao healthcheck próprio e trata SIGTERM.
- É terminantemente proibido `pnpm --filter @planner-fin/web dev`, `vite dev`, preview não endurecido ou watcher em PRD.
- A Fase A deve selecionar e registrar o mecanismo mínimo (Railpack/static server ou imagem/servidor dedicado) conforme suporte vigente. Se exigir dependência, ela precisa de justificativa explícita, lockfile e auditoria; não há autorização para dependência nesta unidade.

### 11.2 API

- Build: workspaces compartilhados + `pnpm --filter @planner-fin/api build` e Prisma generate no momento reprodutível aprovado.
- Start: Node executa o JavaScript compilado em `dist`, com `NODE_ENV=production`, sem Nest watch, ts-node, seed ou migrate dev.
- A aplicação lê `PORT` fornecida por Railway como fonte em PRD (compatibilidade local com `API_PORT` pode permanecer explicitamente testada), escuta `0.0.0.0` e recusa conflito/valor inválido.
- `/api/health` deve ter liveness barato e uma readiness de DB usada no gate. Pode haver `/api/health/ready`; a resposta não inclui DSN, versão sensível, erro SQL ou credencial. A implementação fixa o contrato antes do go-live sem remover o endpoint público existente.
- Shutdown gracioso fecha listener e Prisma após SIGTERM; falha de configuração/migration/startup termina non-zero.

## 12. Variáveis e secrets auditados

| Nome real | Serviço/fase | Secret | Regra PRD |
|---|---|---:|---|
| `DATABASE_URL` | API/migration | Sim | Referência privada do Postgres; nunca URL pública. |
| `PORT` | Web/API | Não | Injetada pelo Railway; bind obrigatório. Hoje ainda não consumida pela API. |
| `API_PORT` | API | Não | Compatibilidade atual/local; não deve sobrepor `PORT` em PRD. |
| `API_HOST` | API | Não | Se mantida, `0.0.0.0` em PRD. |
| `API_CORS_ORIGINS` | API | Não | Lista exata do Web Railway e `https://localhost` somente se necessário ao Android; sem `*`, slash ou path. |
| `API_CORS_ORIGIN` | API | Não | Legado singular; não usar na nova configuração. |
| `JWT_SECRET` | API | Sim | Aleatório, >= requisitos atuais, independente e sealed quando operacionalmente viável. |
| `REFRESH_HMAC_SECRET` | API | Sim | Aleatório, diferente do JWT e sealed quando viável. |
| `JWT_ISSUER` | API | Não | Valor estável aprovado; default atual pode ser preservado. |
| `JWT_AUDIENCE` | API | Não | Valor estável aprovado; default atual pode ser preservado. |
| `COOKIE_SECURE` | API | Não | `true`; ausência já é secure-by-default. |
| `NODE_ENV` | API/Web build | Não | Exatamente `production`; ativa gates negativos. |
| `VITE_API_BASE_URL` | Web/Android build | Público | URL HTTPS da API terminada em `/api`; é pública e fica no bundle. |
| `PLANNER_FIN_KEYSTORE_FILE` | build Android | Sensível | Caminho temporário fora do repo; não é conteúdo da chave. |
| `PLANNER_FIN_KEYSTORE_PASSWORD` | build Android | Sim | Secret do ambiente de release. |
| `PLANNER_FIN_KEY_ALIAS` | build Android | Sensível | Configuração de assinatura, acesso restrito. |
| `PLANNER_FIN_KEY_PASSWORD` | build Android | Sim | Secret do ambiente de release. |

Nomes de bucket serão definidos apenas após a auditoria de integração e devem reutilizar os nomes realmente fornecidos pelo Railway (`BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, `ENDPOINT`) se o cliente escolhido os suportar; não fazem parte do runtime atual. Variáveis `SPEC*_DATABASE_URL`, `PLANNER_FIN_REMOTE_API_BASE_URL`, certificados/proxy e LAN são somente teste/DX e proibidas em PRD.

Secrets ficam em Railway Variables/sealed variables ou secret store do executor Android, com menor acesso, rotação documentada e sem eco em build/log. `.env`, valores reais, keystore e artefatos nunca entram no Git. Alterar JWT/HMAC invalida sessões e requer janela/rollback documentados.

## 13. PostgreSQL, migrations e backups

1. Provisionar PostgreSQL no mesmo projeto/ambiente/região da API e conectar por referência privada.
2. Não habilitar Public Access. Administração excepcional usa mecanismo seguro e temporário, sem publicar DSN em evidência.
3. Executar somente `prisma migrate deploy`, como pre-deploy da API ou job one-shot equivalente, após build e antes da promoção. `prisma migrate dev`, `db push`, seed e reset são proibidos.
4. Um único executor lógico aplica migrations. Concorrência deve respeitar lock do Prisma, mas lock não substitui a orquestração. Repetir deploy sem migration nova deve resultar em no-op.
5. Migrations são preferencialmente aditivas e backward-compatible no padrão expand/migrate/contract. Remoção/rename destrutivo requer SPEC e backup/restore aprovado; rollback de app nunca tenta reverter SQL automaticamente.
6. Health/readiness falha quando a API não conecta ou schema obrigatório não existe; não torna o deploy anterior indisponível.
7. Configurar backup nativo de volume em frequência e retenção disponíveis no plano vigente, com baseline **diário por 7 dias + semanal por 4 semanas**, ou proteção equivalente superior. A disponibilidade/custo deve ser confirmada antes do Hobby go-live.
8. Antes de go-live: backup manual, restore em ambiente isolado do mesmo projeto/ambiente quando exigido pela plataforma, validação de integridade/login com dados sintéticos e registro sanitizado de RPO/RTO medidos. Depois: restore drill trimestral.
9. APK/bucket não é backup do banco. Export lógico adicional criptografado poderá ser aprovado no hardening, nunca improvisado com dados reais em máquina/CI.

## 14. CORS, cookies, CSRF e autenticação

- API aceita somente origens exatas configuradas. `*` é proibido com ou sem credentials; requisição sem Origin continua permitida apenas para clientes diretos/health e depende de autenticação nos endpoints protegidos.
- Web usa HTTPS e `credentials: include`. Refresh permanece `HttpOnly`; CSRF permanece cookie legível + header `X-CSRF-Token` + Origin allowlisted; access token permanece em memória.
- Cookies de PRD têm `Secure`; refresh restringe `Path=/api/auth`; nenhum token vai a localStorage, bundle, URL ou log. Domain não deve ser ampliado para `.railway.app`.
- Antes do go-live, teste real nos dois hosts Railway determina se os requests são same-site ou cross-site segundo o browser. A política deve emitir `SameSite=Lax` quando comprovadamente compatível; se cross-site, somente os cookies necessários usam `SameSite=None; Secure`. A decisão é baseada em teste de Chrome/WebView, não em suposição sobre public suffix.
- `https://localhost` permanece na allowlist somente porque Capacitor usa essa origem e apenas se o E2E Android comprovar necessidade. Não autoriza API local, certificado mkcert ou tráfego HTTP no APK.
- CORS não substitui AuthGuard/owner isolation. Todos os recursos financeiros e sync Android continuam filtrados/autorizados pelo owner no backend.
- Login/register/refresh/logout reais, rotação de refresh, CSRF negativo, origem negada e rate limit integram o smoke de PRD.

## 15. Autodeploy, migrations, healthcheck e restart

```text
merge/push em main
  -> Railway detecta paths relevantes
  -> builds independentes Web/API
  -> API: prisma migrate deploy uma vez
  -> readiness/healthcheck retorna 200
  -> Railway promove novo deploy
  -> smoke HTTPS/auth
```

- Branch trigger dos serviços Web/API: somente `main`; autodeploy habilitado. PRs não fazem deploy em PRD.
- Healthcheck API aponta ao endpoint de readiness aprovado; Web aponta a endpoint/raiz estática que prova processo e arquivo gerado. Timeout é explícito e menor que o limite operacional aceito.
- Como Railway usa healthcheck apenas durante o deploy, monitoramento contínuo externo é fase de hardening; não confundir 200 inicial com disponibilidade permanente.
- Restart API/Web: `On Failure` com limite compatível com Hobby e alerta para crash loop. `Always` só após justificativa. Falha persistente não deve mascarar migration/configuração inválida.
- Falha de build, pre-deploy, startup ou healthcheck não recebe tráfego e conserva versão anterior quando a plataforma permitir. Smoke posterior pode acionar rollback manual imediato.
- APK **não** é gerado, assinado nem publicado por push/merge comum.

## 16. Android: assinatura, release e APK de produção

### 16.1 Identidade e chave

- Preservar `applicationId=com.plannerfin.app`. Toda atualização usa exatamente a mesma signing key.
- Gerar keystore próprio somente na fase autorizada, com algoritmo/tamanho e validade conforme documentação Android vigente. Nunca usar debug key em produção.
- Keystore não commitado, armazenado criptografado em pelo menos duas localizações independentes sob controle do operador; senhas separadas; acesso mínimo; inventário de fingerprint do certificado e teste periódico de recuperação.
- Perda/comprometimento da chave pode impedir atualização ou exigir nova identidade; procedimento de incidente interrompe publicação, revoga links quando possível e comunica testers.
- Os quatro nomes `PLANNER_FIN_KEYSTORE_*` existentes são mantidos, salvo revisão explícita justificada. Processos não imprimem valores nem persistem keystore em artefato/cache.

### 16.2 Versionamento e gatilho

- Tags Android seguem `v0.x.y` e correspondem a `versionName=0.x.y` SemVer sem `v`.
- `versionCode` é inteiro estritamente crescente para cada APK distribuído, inclusive rebuild corretivo; nunca reutilizado. A Fase A define fonte única e valida coerência entre tag, `apps/web/package.json`, Gradle e metadata.
- Gatilho separado: tag/release Android explicitamente aprovada → checkout imutável → testes → build Web com `VITE_API_BASE_URL` PRD → sync Capacitor → assemble release → assinatura → verificação da assinatura → checksum → publicação.
- Tag não coerente, árvore suja, URL sem HTTPS `/api`, chave ausente, assinatura inválida ou versionCode não crescente falha fechado.

### 16.3 Artefato

- Nome canônico: `planner-fin-0.1.0.apk`; sem `internal`, `debug` ou credenciais no nome/conteúdo.
- Produzir APK release assinado e alinhado; verificar certificado/applicationId/versionName/versionCode e instalar em aparelho real suportado.
- Produzir `planner-fin-0.1.0.apk.sha256` e metadata assinável/auditável contendo versão, versionCode, SHA-256, tamanho, data UTC, commit/tag, min/target SDK e URL lógica. Não incluir segredo ou dado de usuário.
- Não commitar APK, checksum gerado, keystore ou output Gradle no Git. Retenção mínima: versão atual e anterior até validar atualização/rollback.

## 17. Distribuição privada e atualização

Fluxo desejado:

```text
release aprovada -> planner-fin-0.1.0.apk -> objeto imutável versionado
                                      +-> checksum/metadata
                                      +-> alias/endpoint latest
```

Railway Bucket é **preferido condicionalmente**, não aceito cegamente: a Fase E deve provar disponibilidade no plano/região, custo, credenciais, limite de objeto, integridade, retenção e serving. Como bucket Railway é privado e não suporta exposição pública direta, a URL estável não pode ser uma presigned URL de até 90 dias fingindo ser permanente. A solução aprovada é um endpoint mínimo controlado que resolve `latest` e redireciona para presigned URL curta, ou storage alternativo aprovado por revisão caso isso acrescente risco/dependência desproporcional.

- Objeto versionado é imutável; publicar mesma chave/versionCode com bytes diferentes é proibido.
- Alias `latest` muda atomicamente somente depois de upload, HEAD/download, SHA-256 e instalação aprovados; aponta à versão, nunca substitui o objeto.
- Link é “privado por compartilhamento”, não autenticação forte. Não indexar, não expor credenciais S3 e permitir revogação/rotação do link. O APK não contém segredo de bucket.
- Tester recebe versão, SHA-256/fingerprint esperado, instrução de habilitar instalação de fonte desconhecida apenas para o instalador usado e de revogar depois. Não pedir desativação global de Play Protect ou bypass de verificação.
- A implementação deve revalidar Android developer verification vigente e registrar impacto sobre distribuição fora da Play Store antes de convidar testers.
- Atualização V1 não é silenciosa: manifest/endpoint HTTPS retorna versão atual, versionCode, URL controlada, SHA-256, tamanho, data e notas. App poderá futuramente avisar; usuário baixa e instala por cima. Mesma `applicationId` + mesma chave + versionCode maior é critério obrigatório.
- Rollback Android operacional significa republicar o link da release anterior compatível; aparelhos já atualizados geralmente não fazem downgrade sobre dados/versão maior. Correção normal exige nova versão/versionCode.

## 18. Custos e limites

- Trial serve somente a validação temporária; crédito/limites/expiração não sustentam rotina. Free não oferece baseline/garantia adequada para este PRD pessoal. **Hobby é baseline antes de depender diariamente do serviço**, sujeito a autorização humana de compra.
- Orçamento V1 mede separadamente assinatura/included usage, CPU/RAM do Web e API, CPU/RAM/volume do PostgreSQL, backups, bucket, volume, egress público e eventuais build minutes conforme tabela vigente.
- Não prometer total exato. Registrar tabela de preços consultada no go-live e estimativa baixa/base/alta; Web/API/Postgres começam com uma réplica e menor recurso que passe carga/smoke, sem HA.
- Configurar alerta de compute antes do go-live e hard usage limit aceito pelo operador. A documentação atual informa mínimo de hard limit e que atingi-lo derruba workloads; portanto, o valor exige aceite humano e runbook de indisponibilidade. Alertas de 75/90/100% não substituem acompanhamento.
- Coletar `Estimated Usage` diariamente por 7 dias completos com uso representativo; no oitavo dia revisar compute por serviço, DB/storage, bucket e egress, projetar mês e ajustar recursos/alertas. Repetir após release relevante.
- Bucket tem custo próprio mutável e pode ficar inacessível ao atingir hard limit; manter canal alternativo de recuperação do APK/chave fora dele.

## 19. Segurança e privacidade

Em `NODE_ENV=production`, startup/build falha se detectar:

- DEV-AUTH ou bypass equivalente, seed/fixture/banco sintético;
- `localhost`, `127.0.0.1`, `10.0.2.2`, `192.168.*`, URL HTTP, mkcert/certificado local em configuração ou bundle PRD;
- `COOKIE_SECURE=false`, CORS `*`/origem inválida ou `VITE_API_BASE_URL` ausente/não HTTPS;
- segredo placeholder/reutilizado, signing debug, keystore no repo ou DB pública.

Logs, métricas, PRs e evidências não contêm access/refresh token, JWT/HMAC/signing/bucket/database secret, cookies/CSRF, Authorization, senha, conteúdo de notificações, payload financeiro, e-mail/IP quando não indispensável ou stack trace com DSN. Logs usam request/correlation ID aleatório, serviço, versão, rota normalizada, status, latência e classe sanitizada de erro. Headers e bodies sensíveis são redigidos na origem.

Aplicar dependências locked, scanner de secrets, TLS, menor privilégio Railway/GitHub, rotação, owner authorization server-side e backup criptografado. APK é código público na prática: não pode conter secret. O link não converte APK em canal confidencial; integridade vem de assinatura e checksum por canal confiável.

## 20. Observabilidade, operação e rollback

### 20.1 Logs, métricas e alertas

- Railway build/deploy logs para instalação, build, migration, startup e health; Log Explorer para ambiente, com retenção vigente registrada no runbook.
- Métricas por serviço: CPU, RAM, rede, disco/volume; DB: conexões, CPU/RAM, volume e falhas; aplicação: taxa 2xx/4xx/5xx, latência, health/readiness, login/refresh (contagem sem identidade), crash/restart e falha de sync Android.
- Alertas mínimos: API/Web indisponível, 5xx sustentado, crash loop, migration falha, DB/storage próximo do limite, backup falho/atrasado, custo e link APK indisponível/checksum divergente.
- Revisão diária na primeira semana, depois semanal; restore drill trimestral e revisão mensal de custo/backup/dependências.

### 20.2 Matriz de rollback

| Incidente | Ação | Dados/limite | Validação |
|---|---|---|---|
| Web ruim | Rollback/redeploy do último deployment saudável | Sem tocar DB | HTTPS, rotas SPA, login e versão. |
| API ruim sem migration incompatível | Rollback da imagem/config anterior | Confirmar compatibilidade de schema | health/readiness, auth, owner isolation. |
| Migration aditiva + app ruim | Manter schema expandido e voltar app compatível | Não executar down automático | smoke e ausência de erro SQL. |
| Migration destrutiva/corrupta | Parar escrita, snapshot/restore aprovado e incidente | Pode perder dados desde RPO; decisão humana | integridade e reconciliação. |
| Secret comprometido | Rotacionar, redeploy, revogar sessões/links conforme classe | JWT/HMAC pode deslogar | secret antigo rejeitado; logs limpos. |
| APK ruim | Tirar `latest`, voltar link à anterior e publicar correção com versionCode maior | Downgrade instalado não é garantido | checksum, instalação limpa e upgrade. |
| Signing key comprometida | Suspender distribuição e seguir incidente | Pode exigir nova identidade | decisão humana/documentação Android vigente. |

Railway rollback/redeploy depende da retenção vigente do plano; o runbook também guarda tag/commit e permite novo build reproduzível. Nunca rollback por force push em `main` ou edição de migration aplicada.

## 21. Passos operacionais e fases futuras

### A — Preparação do repositório

1. Criar SPEC de implementação vinculada; reauditar Railway/Android e dependências.
2. Implementar scripts/start de produção, `PORT`, bind, health/readiness, shutdown e serving SPA.
3. Implementar gates PRD, matriz de env e testes de cookies/CORS.
4. Definir fonte única de versionCode/versionName e pipeline local reproduzível sem gerar chave real em teste.

### B — Infra Railway

1. Criar projeto/ambiente/serviços, branch/watch paths/build/start e domínios Railway.
2. Provisionar PostgreSQL privado, referências/variables/secrets e orçamento/alertas.
3. Configurar migration one-shot, backups, healthchecks e restart.

### C — Go-live Web/API

1. Deploy com dados sintéticos descartáveis, testes HTTPS/CORS/cookie/CSRF/readiness.
2. Restore drill, smoke, logs sanitizados e rollback ensaiado.
3. Autorizar go-live humano; validar login real, owner isolation e redeploy de `main`.

### D — Android release

1. Gerar e custodiar keystore fora do repo após autorização.
2. Criar tag `v0.x.y`, build release com API PRD, assinar/verificar e produzir checksum/metadata.
3. Testar instalação limpa, notification listener/sync PRD e update pela mesma chave.

### E — Distribuição privada

1. Auditar Railway Bucket e decidir go/no-go com evidência.
2. Implementar upload imutável, resolver `latest`, link revogável e manifest de versão.
3. Testar download/checksum/sideload com tester confiável e revisar developer verification.

### F — Hardening, backup e custos

1. Monitoramento contínuo/alertas, rotação e incident runbooks.
2. Observar 7 dias, revisar Estimated Usage e adequar Hobby/limites.
3. Agendar restore drills, revisão de retenção/logs e dependências.

Cada fase pode exigir mais de uma unidade técnica coesa, mas nenhuma pode misturar compra/publicação com mudança não revisada. Ativação paga e go-live permanecem aceites humanos.

## 22. Regras de negócio e decisões

| ID | Regra/decisão aprovada |
|---|---|
| RN-01 | Railway é o hosting inicial de PRD pessoal; Hobby é baseline antes de dependência diária. |
| RN-02 | Web/API autodeployam somente por `main`; Android somente por tag/release aprovada. |
| RN-03 | Web nunca usa servidor de desenvolvimento em PRD. |
| RN-04 | PostgreSQL permanece privado e migration usa exclusivamente `prisma migrate deploy`, uma vez. |
| RN-05 | Hosts Web/API são distintos com HTTPS, CORS explícito e cookies/CSRF comprovados em browser/WebView. |
| RN-06 | Healthcheck bloqueia promoção ruim, mas monitoramento contínuo é separado. |
| RN-07 | APK de cada versão é imutável, assinado pela mesma chave e acompanhado de SHA-256/metadata. |
| RN-08 | Chave, APK e secrets nunca são commitados; APK não contém secrets. |
| RN-09 | Link privado usa bucket apenas após auditoria e não expõe credencial nem presume bucket público. |
| RN-10 | Rollback de app não reverte migration automaticamente; migrations são backward-compatible. |
| RN-11 | Hard usage limit, pagamento e go-live exigem aceite humano informado. |
| RN-12 | DEV-AUTH, seed, endpoints/URLs/certificados locais e logs sensíveis são recusados em PRD. |

## 23. Critérios de aceite Given/When/Then

### CA-01 — Web HTTPS e SPA
**Dado** um deployment Web de `main` com URL Railway, **quando** o usuário acessa a raiz e uma rota profunda por HTTPS, **então** ambos servem a SPA de produção, sem Vite dev, mixed content ou fallback local.

### CA-02 — API health/readiness
**Dado** API e DB saudáveis, **quando** Railway consulta o healthcheck, **então** recebe 200 sem segredo; **e dado** DB/schema indisponível, **quando** consulta readiness, **então** a nova versão não é promovida.

### CA-03 — Login, refresh, cookie e CSRF
**Dado** Web e API em seus hosts HTTPS reais, **quando** usuário registra/loga, recarrega, renova e sai, **então** access/refresh/CSRF funcionam, refresh é HttpOnly/Secure, origem permitida usa credentials e origem/CSRF inválidos recebem rejeição.

### CA-04 — Owner isolation
**Dado** dois usuários reais de teste, **quando** um tenta acessar ID/recurso/sync do outro, **então** backend nega sem revelar dados, inclusive por chamada direta fora da UI.

### CA-05 — DB privado
**Dado** PostgreSQL PRD, **quando** se audita Networking e conexão API, **então** não há Public Access/TCP Proxy e `DATABASE_URL` resolve pela rede privada.

### CA-06 — Migration exatamente uma vez
**Dado** migration nova backward-compatible, **quando** API faz deploy e redeploy do mesmo commit, **então** `prisma migrate deploy` aplica uma vez e depois é no-op; nunca executa migrate dev/seed/reset.

### CA-07 — Autodeploy e bloqueio ruim
**Dado** commit mergeado em `main`, **quando** paths Web/API relevantes mudam, **então** serviços aplicáveis deployam automaticamente; build/start/health ruim não substitui deployment saudável.

### CA-08 — Rollback Web/API
**Dado** release anterior compatível e falha induzida sanitizada, **quando** operador segue runbook, **então** Web/API voltam ao commit anterior sem force push nem down migration e smoke volta a passar.

### CA-09 — Guard de produção
**Dado** build/start com `NODE_ENV=production`, **quando** DEV-AUTH/bypass, seed, URL local/LAN/HTTP, mkcert, cookie inseguro, CORS wildcard ou secret placeholder é injetado, **então** processo falha fechado antes de receber tráfego.

### CA-10 — Backup e restore
**Dado** backup PRD agendado e snapshot manual, **quando** restore drill isolado é executado, **então** schema/dados sintéticos íntegros são recuperados e RPO/RTO sanitizados ficam registrados.

### CA-11 — APK PRD assinado
**Dado** tag válida `v0.x.y`, **quando** release Android é aprovada, **então** APK release assinado usa API HTTPS PRD, applicationId correto, versionName/tag coerente e versionCode crescente, sem endpoints locais ou secrets.

### CA-12 — Notification sync PRD
**Dado** APK instalado e usuário autenticado, listener consentido e pacote monitorado, **quando** notificação fictícia elegível é capturada e SPA sincroniza, **então** chega somente ao owner/dispositivo corretos na API PRD, sem token/conteúdo sensível em logs.

### CA-13 — Atualização pela mesma chave
**Dado** primeira release instalada, **quando** segunda release com mesma applicationId/chave e versionCode maior é instalada, **então** Android atualiza por cima, preserva dados esperados e o certificado verificado é o mesmo.

### CA-14 — Link, checksum e sideload
**Dado** artefato versionado publicado, **quando** tester confiável abre o link estável, baixa e verifica, **então** obtém versão correta, SHA-256 correspondente e instala por sideload seguindo avisos Android vigentes; nenhuma credencial de bucket é exposta.

### CA-15 — Alias/rollback APK
**Dado** APK corrente reprovado, **quando** operador despublica `latest`, **então** link deixa de apontar ao artefato ruim e oferece anterior compatível ou nova correção, sem sobrescrever objetos/versionCode.

### CA-16 — Logs sanitizados
**Dado** login, erro, migration, sync e download, **quando** logs Railway/build são auditados, **então** não contêm credenciais, tokens, cookies, dados financeiros/notificações, DSN ou senha de signing.

### CA-17 — Custo observado
**Dado** Hobby e alertas autorizados, **quando** PRD completa 7 dias, **então** operador registra Estimated Usage por categoria, projeção mensal, hard limit/risco de shutdown e decisão de ajuste sem prometer custo fixo.

## 24. Testes e evidências obrigatórios da implementação

| Nível | Cobertura mínima | Evidência sanitizada |
|---|---|---|
| Unitário | env PRD, PORT/bind, URL/CORS/cookie policy, metadata/versão/checksum e guards negativos | comando, casos e resultado |
| Integração | Prisma migrate deploy/redeploy, readiness DB, shutdown, serving/fallback SPA, upload/resolve bucket | logs sem DSN/secret |
| Contrato | health/readiness, manifest Android/latest, metadata e erros | request/response sanitizados |
| E2E Web/API/Postgres | HTTPS, login/refresh/logout/CSRF, owner isolation, deploy ruim e rollback | URLs mascaradas quando necessário e resultado |
| E2E Android/API/Postgres | instalação, login, notificação fictícia, binding/sync, logout/purge e owner isolation | aparelho/API/build, sem conteúdo real |
| Segurança | secret scan, conteúdo APK, headers cookies/CORS, DB pública, logs e assinatura | relatório sanitizado |
| Aceitação manual | domínio, restore, autodeploy, rollback, sideload, update pela mesma chave, link e custo 7 dias | checklist assinado pelo operador/tester |

Lint, typecheck, unitários, integração aplicável e build são obrigatórios em cada unidade técnica. Nesta unidade somente documental, testes runtime/E2E/build são não aplicáveis; validação Markdown, links, diff e ausência de segredo são aplicáveis.

## 25. Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação/gate |
|---|---:|---:|---|
| Cookie falhar entre hosts Railway/WebView | Média | Alto | Prova em host real, atributos por ambiente, E2E Chrome/Android antes do go-live. |
| Migration incompatível bloquear rollback | Média | Crítico | Expand/contract, backup, readiness e sem down automático. |
| Trial expirar/hard limit derrubar PRD | Média | Alto | Hobby antes de dependência, alertas, aceite do limite e runbook. |
| DB/backup não restaurável | Baixa/média | Crítico | DB privado, backup diário/semanal, restore drill e RPO/RTO. |
| Signing key perdida/comprometida | Baixa | Crítico | Duas cópias criptografadas, menor acesso, fingerprint e recovery drill. |
| Bucket não oferecer URL pública estável | Alta | Médio | Endpoint de resolução/presign curto; go/no-go e alternativa por revisão. |
| APK/link adulterado | Média | Alto | assinatura Android, SHA-256 por canal confiável, objetos imutáveis. |
| Sideload/developer verification mudar | Média | Alto | Reauditoria Android na release e instruções sem bypass. |
| Logs vazarem finanças/segredos | Média | Crítico | redaction na origem, teste de log, acesso/retenção mínimos. |
| Autodeploy de shared package incompleto | Média | Alto | watch paths explícitos e teste de mudança compartilhada. |
| Health estático promover API sem DB | Alta hoje | Alto | readiness dependente de DB/schema e monitoramento externo. |
| Custos excederem estimativa | Média | Médio/alto | 7 dias medidos, right-size, alertas e hard limit informado. |

## 26. Decisões adiadas e dependências de validação

Não bloqueiam a aprovação desta arquitetura, mas bloqueiam a fase indicada:

1. mecanismo exato de serving Web (Railpack/static server versus imagem dedicada) — Fase A, sem Vite dev;
2. contrato/nome final do endpoint de readiness — Fase A, preservando `/api/health`;
3. atributos SameSite efetivos nos hosts gerados e WebView — Fase C, definidos por teste;
4. plano/frequência/retention real de backups e restore no plano vigente — Fase B/C;
5. go/no-go do Railway Bucket e desenho do resolver de link — Fase E;
6. executor de release Android (local endurecido ou automação futura) — Fase D; GitHub Actions não é autorizado agora;
7. developer verification, requisitos de identidade/distribuição e UX de sideload vigentes — Fase D/E;
8. custom domain, Play Store, auto-update, staging permanente, CDN, mesma origem/reverse proxy e HA — futuras revisões/ADRs.

Nenhuma dessas validações permite trocar a topologia, enfraquecer segurança ou ativar cobrança silenciosamente. Resultado incompatível exige revisão humana da SPEC.

## 27. Dúvidas

Não há dúvida funcional/arquitetural aberta para aprovar o contrato documental. Valores reais de domínio, secrets, orçamento/hard limit e retenção serão deliberadamente definidos com aceite humano nas fases operacionais e não devem ser inventados nesta SPEC.

## 28. Definition of Done específica

- [x] Auditoria AS-IS distingue capacidades e lacunas.
- [x] Topologia, domínios, deploys, migrations, auth, release Android e distribuição estão definidos.
- [x] Nomes reais de variáveis atuais foram auditados; nomes futuros de bucket estão condicionados à integração real.
- [x] Critérios GWT cobrem o aceite mínimo solicitado.
- [x] Custos não são prometidos e incluem Trial/Free/Hobby, 7 dias, alerta e hard limit.
- [x] Riscos, rollback, fases e decisões adiadas estão explícitos.
- [x] Esta unidade altera somente os dois arquivos documentais autorizados e não adiciona dependência.
- [ ] Implementação e evidências operacionais — deliberadamente futuras e fora desta unidade.
- [ ] Aceite humano de cobrança/go-live/signing/distribuição — obrigatório antes das respectivas ações.

## 29. Histórico de decisões e alterações

| Data | Alteração/decisão | Origem/aprovador | Consequência |
|---|---|---|---|
| 2026-08-14 | Criação e aprovação da SPEC-023 | Solicitante do DOC-SPEC-023 | Autoriza planejar unidades futuras, não deploy/compra. |
| 2026-08-14 | Railway/Hobby como baseline e domínios Railway sem compra | Prompt aprovado | Trial é validação; produção cotidiana não depende de Free/Trial. |
| 2026-08-14 | Web/API em hosts públicos distintos; DB privado | Prompt + auditoria | Exige CORS/cookie E2E; evita proxy novo. |
| 2026-08-14 | `main` deploya Web/API; tag release gera Android | Prompt aprovado | APK nunca é produzido a cada commit. |
| 2026-08-14 | Bucket Railway é preferência condicional | Documentação oficial atual | Bucket privado exige resolver/presign ou alternativa aprovada. |

## 30. Veredito documental

**APROVADA para planejamento/implementação futura em unidades próprias. BLOQUEADA para deploy, cobrança, geração de chave, publicação de APK ou go-live nesta tarefa documental.**
