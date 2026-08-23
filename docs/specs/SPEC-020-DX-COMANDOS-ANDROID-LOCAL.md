# SPEC de funcionalidade - `SPEC-020 - DX comandos Android local`

## 1. Identificacao

| Campo | Valor |
|---|---|
| ID | `SPEC-020` |
| Titulo | `DX comandos Android local` |
| Responsavel | `Codex` |
| Data de criacao | `2026-08-13` |
| Ultima atualizacao | `2026-08-22` |
| Tarefa relacionada | Prompts `DX: comandos simples para ambiente Android/telefone`, `bootstrap de máquina Windows nova + pnpm env:doctor` e fechamento do PR #109 |
| Documentos relacionados | [SPEC-012](SPEC-012-ANDROID-INTERNO-CAPACITOR.md), [WINDOWS-BOOTSTRAP](../runbooks/WINDOWS-BOOTSTRAP.md), [GIT-WORKFLOW](../process/GIT-WORKFLOW.md), [Definition of Done](../quality/DEFINITION-OF-DONE.md) |

## 2. Status

`Aprovada`

**Aprovada por:** prompt da tarefa em `2026-08-13`.

## 3. Contexto

O projeto ja possui Capacitor Android, Docker Compose para PostgreSQL, API NestJS em `/api`, build debug Android e certificados locais ignorados em `.tools/certs`. A primeira versao da DX local pressupunha dependencias externas ja instaladas; uma maquina Windows nova ainda precisava de bootstrap explicito e diagnostico reproduzivel.

## 4. Problema

Pessoas desenvolvedoras precisam preparar uma maquina Windows nova e iniciar API, banco, proxy HTTPS, emulador e builds APK com comandos previsiveis, sem expor portas sensiveis, versionar segredos ou permitir que o diagnostico altere a maquina.

## 5. Objetivo

Adicionar tooling local versionado para `pnpm env:doctor`, bootstrap Windows, `.env` único na raiz, `pnpm dev:android`, `pnpm dev:android:services`, `pnpm dev:phone`, builds APK emulator/LAN/remote, servidor local de APK e stop seguro por PID.

## 6. Fora do escopo

- Alterar dominio financeiro, autenticacao funcional, autorizacao, migrations ou regras de negocio.
- Expor automaticamente ambiente pela internet, abrir firewall/roteador ou criar servico pago.
- Versionar certificados privados, `.env`, keystore, APK ou logs.
- Instalar software, iniciar Docker, criar AVD, alterar variaveis/recursos do Windows ou aceitar licencas pelo `pnpm env:doctor`.

## 7. Termos

| Termo | Definicao |
|---|---|
| Proxy HTTPS | Servidor local em `3443` que encaminha para API HTTP em `127.0.0.1:3000`. |
| LAN | Rede privada local do Windows para uso por celular fisico. |
| Runtime local | Estado gerado em `.tools/runtime`, ignorado pelo Git. |

## 8. Comportamento atual

Scripts raiz cobrem `dev`, `db:up`, `db:migrate`, `android:build:debug` e `android:build:internal`. O proxy HTTPS existe apenas como arquivo local ignorado em `.tools/https-proxy.mjs`.

## 9. Comportamento desejado

Os aliases raiz devem orquestrar dependencias locais, banco, migrations, API, proxy HTTPS, health checks, ambiente Android, emulador, builds APK e servidor Python conforme o prompt aprovado. `pnpm env:doctor` deve somente diagnosticar Core, Docker, JDK, SDK Android, variaveis e estado do projeto, com readiness independente por trilha e proximos passos; nao pode corrigir ou alterar o ambiente. O ambiente local usa somente o `.env` da raiz, carregado por mecanismo Node multiplataforma antes de Prisma, API e Web, sem sobrescrever variaveis existentes em `process.env`. O runbook Windows deve documentar os dois caminhos de SDK (Android Studio ou command-line tools), componentes exatos e primeiro start. PostgreSQL deve publicar `5432` somente no loopback. A API deve poder ser iniciada pelos scripts em `127.0.0.1:3000`; o proxy HTTPS escuta `0.0.0.0:3443`. Builds LAN bloqueiam quando o certificado nao cobre o IP. Modo remoto exige URL HTTPS explicita e segura.

## 10. Personas ou atores

| Ator | Necessidade | Acoes autorizadas |
|---|---|---|
| Pessoa desenvolvedora | Rodar PlannerFin local/Android. | Executar comandos `pnpm` documentados. |
| Celular fisico | Consumir API via HTTPS LAN. | Acessar somente proxy `3443`. |

## 11. Fluxos

### 11.1 Fluxo principal

1. Pessoa executa `pnpm dev:android` ou variante.
2. Script valida Node e Docker, sobe PostgreSQL, aplica migrations e inicia API/proxy.
3. Health checks confirmam `3000` e `3443`.
4. Quando aplicavel, AVD `Pixel_7_Pro` e iniciado e aguardado.
5. Resumo final mostra URLs e PIDs.

### 11.2 Fluxos alternativos e excecoes

- Porta ocupada por processo desconhecido falha com mensagem clara.
- Docker Desktop fechado e executavel encontrado e iniciado; sem executavel, falha.
- Certificado sem IP LAN bloqueia build LAN.
- Modo remoto sem HTTPS ou com credenciais bloqueia build.

## 12. Regras de negocio

Nao aplicavel: nao ha regra financeira nova.

## 13. Modelo de dados

Nao aplicavel: nenhuma entidade ou migration.

## 14. Contratos de API

Nao aplicavel: contratos HTTP existentes permanecem inalterados.

## 15. Interface

Nao aplicavel: sem mudanca de UI do produto.

## 16. Validacoes

| Acao | Validacao | Resultado esperado |
|---|---|---|
| Startup | Node >=22 e Docker engine disponivel. | Continua ou falha claramente. |
| Doctor | Ferramentas, versoes, paths e componentes locais. | Reporta `OK`, `MISSING`, `WRONG VERSION`, `INSTALLED_BUT_STOPPED`, warning ou unknown sem mutacao. |
| LAN | IPv4 privado nao virtual. | URL `https://<LAN_IP>:3443/api`. |
| Remoto | HTTPS absoluto sem credenciais. | Build permitido somente se valido. |
| PIDs | Processo registrado e vivo. | Reutiliza ou para somente o registrado. |

## 17. Permissoes

Nao aplicavel: scripts locais nao alteram autorizacao do produto.

## 18. Seguranca e privacidade

API `3000` nao deve ser aberta publicamente pelos scripts. PostgreSQL `5432` nao deve ser exposto remotamente pelos scripts. Certificados privados, `.env`, keystores, APKs e logs permanecem fora do Git. Modo remoto nao ativa DEV-AUTH, nao aceita HTTP e nao desativa TLS.

## 19. Erros e estados vazios

Erros operacionais devem apontar a dependencia ausente ou porta/processo conflitante sem imprimir segredos.

## 20. Observabilidade

Logs locais ficam em `.tools/runtime/logs`, ignorados pelo Git e sem segredos intencionais.

## 21. Migracao e compatibilidade

Sem migracao. Scripts existentes continuam disponiveis.

## 22. Criterios de aceite

### `CA-01 - Startup Android`

**Dado** ambiente Windows com Node, Docker e Android SDK
**Quando** `pnpm dev:android` for executado
**Entao** banco, migrations, API, proxy e AVD devem iniciar e exibir resumo.

### `CA-02 - Services sem emulador`

**Dado** ambiente local
**Quando** `pnpm dev:android:services` ou `pnpm dev:phone` for executado
**Entao** nenhum AVD deve ser iniciado.

### `CA-03 - Builds APK`

**Dado** projeto Android configurado
**Quando** builds emulator, LAN ou remoto forem executados
**Entao** `VITE_API_BASE_URL` deve ser composta corretamente e o caminho do APK impresso.

### `CA-04 - Stop seguro`

**Dado** processos iniciados pelos scripts
**Quando** `pnpm dev:android:stop` for executado
**Entao** somente processos registrados devem ser parados.

### `CA-05 - Bootstrap e diagnostico nao mutavel`

**Dado** uma maquina Windows nova ou parcialmente configurada
**Quando** `pnpm env:doctor` for executado
**Entao** Git, Node/pnpm, PowerShell, Python, winget, Docker, JDK 21, SDK/platform/build-tools Android, adb/emulator, AVD, variaveis e arquivos do projeto devem ser diagnosticados separadamente, com readiness por trilha e sem instalar, iniciar ou alterar recursos.

### `CA-06 - Configuracao raiz utilizavel`

**Dado** um clone novo com `.env` na raiz e Docker/PostgreSQL disponiveis
**Quando** `pnpm db:migrate`, `pnpm dev`, `pnpm dev:api` ou `pnpm dev:android:services` for executado
**Entao** Prisma e API devem herdar as variaveis da raiz sem copia para subpastas, preservando a prioridade de `process.env` externo, e o doctor so deve declarar API/Database READY com `DATABASE_URL` PostgreSQL valida.

## 23. Testes obrigatorios

| Nivel | Cenarios minimos | Criterios relacionados | Evidencia esperada |
|---|---|---|---|
| Unitario | LAN, URL, remoto invalido, env temporaria, prioridade de `process.env`, `.env`/`DATABASE_URL` ausente ou invalida, sanitizacao de secrets, parsing de versoes, dependencias ausentes/incorretas e readiness. | CA-02, CA-03, CA-05, CA-06 | `pnpm test:dx`. |
| Integracao | Startup/stop local quando ambiente permitir. | CA-01, CA-04 | Resultado manual. |
| E2E | Nao aplicavel; sem UI de produto. | Nao aplicavel | Justificativa no PR. |
| Aceitacao manual | Comandos solicitados no prompt. | CA-01 a CA-06 | Registro de execucao ou limitacao ambiental. |

## 24. Arquivos permitidos

- `package.json`
- `docker-compose.yml`
- `scripts/doctor.mjs`
- `scripts/doctor-lib.mjs`
- `scripts/doctor.test.mjs`
- `scripts/root-env.mjs`
- `scripts/root-env.test.mjs`
- `scripts/run-with-root-env.mjs`
- `scripts/android/**`
- `docs/runbooks/WINDOWS-BOOTSTRAP.md`
- `docs/runbooks/LOCAL-ANDROID-DEVELOPMENT.md`
- `docs/specs/SPEC-020-DX-COMANDOS-ANDROID-LOCAL.md`
- `docs/specs/README.md`
- `apps/api/src/config/env.ts`
- `apps/api/src/config/env.spec.ts`
- `apps/api/src/main.ts`

## 25. Arquivos proibidos

- `apps/api/prisma/**`
- Dominio financeiro em `apps/api/src/**` fora de config/bootstrap.
- UI do produto em `apps/web/src/**`.
- Certificados, `.env`, keystores, APKs e logs.

## 26. Dependencias

Nenhuma dependencia npm nova. Usa ferramentas locais ja esperadas: Git, winget opcional, PowerShell, Node/Corepack, pnpm, Docker, Android SDK/JDK e Python. O Android Studio permanece opcional.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Certificado local desatualizado. | Media | APK LAN sem conectividade. | Bloquear build LAN sem SAN correto. |
| Porta ocupada. | Media | Startup inconsistente. | Falhar se processo desconhecido ocupar porta. |
| Ambiente Android ausente. | Media | `dev:android` ou build falha. | Mensagem clara e docs. |
| Doctor produzir efeito colateral. | Baixa | Alteracao inesperada da maquina. | Implementacao Node somente leitura e testes de fixtures/injecao. |

## 28. Rollback

Reverter o commit remove scripts, aliases e documentacao. Sem migration ou transformacao de dados.

## 29. Duvidas

Nao ha duvidas abertas.

## 30. Decisoes aprovadas

| Data | Decisao | Responsavel pela aprovacao | Consequencia |
|---|---|---|---|
| 2026-08-13 | Implementar tooling local sem novas dependencias e sem exposicao publica automatica. | Prompt da tarefa | Scripts PowerShell e Node versionados. |
| 2026-08-21 | Adicionar bootstrap Windows e `pnpm env:doctor` somente diagnostico, com Android Studio opcional. | Prompt de bootstrap de maquina Windows nova | Runbook completo, componentes Android exatos e readiness independente. |
| 2026-08-22 | Renomear o alias para `pnpm env:doctor` e usar `.env` unico na raiz com prioridade para `process.env`. | Prompt de fechamento do PR #109 | Prisma/API local compartilham loader Node; doctor valida `DATABASE_URL` utilizavel sem expor secrets. |

## 31. Definition of Done especifica

- [ ] Aliases solicitados existem na raiz.
- [ ] Proxy HTTPS versionado sem certificar/chaves privadas.
- [ ] Testes unitarios dos helpers passam.
- [ ] `pnpm env:doctor` nao altera a maquina e possui testes de dependencias/versoes/readiness/configuracao.
- [ ] Prisma e API local carregam o `.env` unico da raiz sem sobrescrever `process.env`.
- [ ] Bootstrap Windows documenta instalacao manual e os componentes Android exatos.
- [ ] Checks obrigatorios foram executados ou limitacao ambiental foi registrada.

## 32. Historico de alteracoes da SPEC

| Data | Alteracao | Motivo | Autor | Aprovador, quando aplicavel |
|---|---|---|---|---|
| 2026-08-13 | Criacao aprovada da SPEC-020. | Registrar a unidade DX Android local. | Codex | Prompt da tarefa |
| 2026-08-21 | Ampliacao aprovada para bootstrap Windows e doctor somente diagnostico. | Tornar primeira configuracao reproduzivel em maquina nova. | Codex | Prompt da tarefa |
| 2026-08-22 | Ajuste aprovado do alias e carregamento do `.env` raiz. | Remover colisao do pnpm e falso READY de API/Database. | Codex | Prompt de fechamento do PR #109 |
| 2026-08-22 | `env:doctor` passa a checar `https://localhost` em `API_CORS_ORIGINS` e `API_CROSS_SITE_ORIGINS`; `.env.example` e `dev-android.ps1` declaram `API_CROSS_SITE_ORIGINS` explicitamente. | Evitar regressao de sessao Android nao persistindo apos reinicio do app em novos ambientes. | Equipe PlannerFin | Solicitante da tarefa |
