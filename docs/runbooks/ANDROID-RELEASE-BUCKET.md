# Release Android assinado + distribuição via Railway Bucket (SPEC-023 Fases D/E)

## Escopo

Este runbook documenta o suporte técnico preparado para gerar um APK Android de produção
assinado, com checksum e metadata, e distribuí-lo por um bucket privado S3-compatível
(Railway Bucket), mantendo histórico imutável e um endpoint estável de download da versão
mais recente. **Nenhuma publicação real foi feita por esta unidade**: não há keystore real,
não há bucket Railway criado e nenhuma versão foi publicada. A seção
[Primeira release real](#primeira-release-real-passo-a-passo) descreve os passos manuais
necessários depois do merge desta PR.

Fonte de verdade: `docs/specs/SPEC-023-DEPLOY-PRD-RAILWAY-ANDROID.md` (§16, §17, §21).

## Arquitetura

- **Versionamento**: `apps/web/package.json.version` é a fonte de `versionName` (SemVer
  `0.x.y`); `apps/web/android/version.json.versionCode` é a fonte única de `versionCode`
  (inteiro, sempre crescente). Ambos são lidos por `apps/web/android/app/build.gradle` via
  `JsonSlurper`.
- **Assinatura**: `signingConfigs.plannerFin` no `build.gradle` é compartilhada pelos
  buildTypes `internal` e `release`, usando as quatro variáveis já existentes
  `PLANNER_FIN_KEYSTORE_FILE`, `PLANNER_FIN_KEYSTORE_PASSWORD`, `PLANNER_FIN_KEY_ALIAS`,
  `PLANNER_FIN_KEY_PASSWORD`. Um guard em `gradle.taskGraph.whenReady` falha fechado se
  qualquer uma faltar ao rodar `assembleRelease`/`bundleRelease`/`assembleInternal`/etc.
- **Build de release**: `apps/web/scripts/build-android-release.mjs` valida
  `VITE_API_BASE_URL` de produção (reaproveita `assertProductionWebApiBaseUrl`), valida as
  variáveis de assinatura, roda `assembleRelease`, e **exige** verificação do APK gerado:
  `apksigner` precisa estar no PATH e validar a assinatura (falha fechado se ausente ou se
  reportar assinatura inválida, incluindo detecção de assinatura acidental com a keystore de
  debug local), e `aapt` **ou** `apkanalyzer` precisa estar no PATH e confirmar
  applicationId/versionName/versionCode do APK (falha fechado se nenhum dos dois estiver
  disponível, ou se o APK gerado divergir). Não existe modo "melhor esforço" para release —
  `debug`/`internal` (via `build-android.mjs`) não são afetados por essa exigência. Ao final,
  calcula SHA-256 e grava `artifacts/android-releases/<version>/{planner-fin-<version>.apk,
  .apk.sha256, metadata.json}`.
- **Storage isolado**: `@planner-fin/storage` (novo pacote do workspace) encapsula
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` atrás de uma interface
  `ReleaseStorage` (`headObject`, `putObjectIfAbsent`, `putObject`, `getObject`,
  `deleteObject`, `listKeys`, `presignGetObject`) com duas implementações:
  `createS3ReleaseStorage` (real)
  e `createInMemoryReleaseStorage` (fake, usada em todos os testes automatizados — nada
  toca o Railway real em CI). Railway Bucket não suporta object-lock/versionamento nativo,
  então a imutabilidade é garantida pela aplicação (checagem antes do upload), não pelo
  backend de storage.
- **Publish**: `apps/web/scripts/publish-android-release.mjs` lê os artefatos locais, exige
  `--yes` explícito. Se a versão ainda não existe no bucket, faz upload do APK +
  `.sha256` + `metadata.json` (sempre via `putObjectIfAbsent`, que falha se o objeto já
  existir), verifica o objeto remoto (novo download + SHA-256) e só então substitui
  `android/latest.json` via `putObject` (PUT direto, nunca delete seguido de put) — o único
  objeto mutável do layout, pois é apenas um ponteiro, nunca o APK. Se a verificação remota
  falhar, os objetos recém-enviados são removidos antes de retornar erro (nada fica "meio
  publicado"); `latest.json` nunca fica ausente entre duas publicações.
- **Publish idempotente (retry seguro)**: se a versão **já existe** no bucket, o publish
  não falha automaticamente — compara `metadata.json` remoto com o build local
  (`version`, `versionCode`, `sha256`, `size`, `applicationId`, via
  `assertRemoteReleaseMatchesLocal`). Se todos os campos baterem, é tratado como sucesso
  idempotente: **nada é reenviado** (nenhum `putObjectIfAbsent` novo para APK/`.sha256`/
  `metadata.json` — a release histórica nunca é tocada), e `latest.json` só é atualizado se
  ainda não apontar para essa mesma release (nunca "rebaixado" se uma versão mais nova já
  tiver sido publicada depois). Isso torna reexecutar `publish` após uma falha de rede/CLI
  na etapa de `latest.json` seguro, sem exigir bump de versão. Se qualquer campo divergir
  (artefato diferente sob o mesmo número de versão), falha fechada com mensagem explícita de
  conflito/imutabilidade — a release remota original permanece intacta.
- **API de leitura**: `apps/api/src/releases/*` expõe os quatro endpoints públicos abaixo,
  usando o mesmo `@planner-fin/storage` em modo somente leitura/presign. Se as variáveis do
  bucket não estiverem configuradas, a API continua subindo normalmente (não quebra o
  deploy atual) e os endpoints respondem `503 RELEASES_NOT_CONFIGURED`.

## Comandos

```powershell
pnpm install --frozen-lockfile
pnpm android:release:build             # valida, builda assembleRelease, verifica, gera artefatos locais
pnpm android:release:publish -- --yes  # publica os artefatos da versão atual no bucket (exige variáveis do bucket)
```

Sem `--yes`, `android:release:publish` só imprime o plano (dry-run) e não altera nada
remoto. `--version=0.1.1` pode ser passado para publicar uma versão diferente da atual de
`package.json`. O publish nunca cria tag, nunca faz push/merge e nunca gera keystore.

## Variáveis de ambiente

| Variável | Uso | Regra |
|---|---|---|
| `PLANNER_FIN_KEYSTORE_FILE` / `_PASSWORD` / `PLANNER_FIN_KEY_ALIAS` / `_PASSWORD` | Build `release`/`internal` | Já existentes; keystore externo ao repo, nunca gerado automaticamente. |
| `VITE_API_BASE_URL` | Build `release` | HTTPS, termina em `/api`, rejeita localhost/127.0.0.1/10.0.2.2/192.168.\*. |
| `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` | Publish local + API (leitura/presign) | Nomes exatos fornecidos pelo Railway Bucket (S3-compatível); nunca expostas ao Web/Android; ausentes = feature desligada, não erro de boot. |

## Artefatos e layout no bucket

```text
android/
├── releases/
│   ├── 0.1.0/
│   │   ├── planner-fin-0.1.0.apk
│   │   ├── planner-fin-0.1.0.apk.sha256
│   │   └── metadata.json
│   └── 0.1.1/
│       └── ...
└── latest.json
```

`metadata.json`: `version`, `versionCode`, `sha256`, `size`, `createdAt` (UTC), `gitCommit`,
`applicationId`, `minSdk`, `targetSdk`, `apiBaseUrl`. Nunca contém segredo, keystore ou dado
de usuário. Nenhuma release antiga é apagada — o histórico completo permanece acessível.

## Endpoints

| Rota | Comportamento |
|---|---|
| `GET /api/releases/android/latest` | Resolve `latest.json`, gera presigned URL curta (60s) e responde 302; `Cache-Control: no-store`; rate limit por IP. |
| `GET /api/releases/android` | Lista `latest` + histórico de versões (versionCode desc). |
| `GET /api/releases/android/:version` | Redireciona (302) para a versão específica; versão validada estritamente (`^\d+\.\d+\.\d+$`), bloqueando path traversal. |
| `GET /api/releases/android/:version/metadata` | Retorna o `metadata.json` da versão. |

Erros são sempre sanitizados (`{error:{code,message}}`, sem detalhe interno de bucket/stack):
`RELEASES_NOT_CONFIGURED` (503), `RELEASE_NOT_FOUND`/`RELEASE_LATEST_NOT_FOUND` (404),
`RELEASE_LATEST_CORRUPTED`/`RELEASE_METADATA_CORRUPTED` (503), `INVALID_VERSION` (400),
`RATE_LIMITED` (429).

## Primeira release real (passo a passo)

Nenhum destes passos foi executado por esta unidade — todos exigem ação humana e
confirmação explícita.

1. Gerar a keystore de produção manualmente (`keytool -genkeypair`, ver
   `docs/runbooks/ANDROID-INTERNAL.md` para o comando de referência) e guardá-la fora do
   repositório, com backup em ao menos dois locais independentes.
2. Definir localmente `PLANNER_FIN_KEYSTORE_FILE`, `PLANNER_FIN_KEYSTORE_PASSWORD`,
   `PLANNER_FIN_KEY_ALIAS`, `PLANNER_FIN_KEY_PASSWORD` (mesmo shell, nunca versionado).
3. Rodar `pnpm android:release:build` com `VITE_API_BASE_URL` apontando para a API PRD
   Railway, gerando `planner-fin-0.1.0.apk` em `artifacts/android-releases/0.1.0/`.
4. Verificar a assinatura do APK gerado (`apksigner verify --print-certs`) e conferir o
   fingerprint contra o inventário de chaves.
5. Instalar o APK em um telefone real (`adb install`) e validar login contra a API PRD.
6. Testar o NotificationListener e a sincronização de notificações contra a API PRD.
7. Criar manualmente o Railway Bucket (auditando a documentação oficial vigente antes de
   confirmar plano/região/custo) — esta unidade não cria bucket automaticamente.
8. Definir `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` no ambiente
   do publisher local (e, separadamente, na API caso ela deva servir os downloads).
9. Rodar `pnpm android:release:publish -- --yes` para publicar `0.1.0`.
10. Abrir `GET /api/releases/android/latest` e confirmar o redirect para o APK.
11. Baixar o APK pelo telefone através desse endpoint e instalar.
12. Para a próxima versão, gerar `0.1.1` com a mesma chave e `versionCode` maior
    (`apps/web/android/version.json`), repetindo os passos 3–9; o telefone já atualizado
    recebe a atualização instalando por cima da `0.1.0`.

## Troubleshooting

| Sintoma | Verificação |
|---|---|
| `android:release:build` falha por variável de assinatura | Configure as quatro `PLANNER_FIN_KEY*`; nunca geradas automaticamente. |
| `android:release:build` falha por `VITE_API_BASE_URL` | Precisa ser HTTPS, terminar em `/api` e não pode ser localhost/LAN. |
| `android:release:publish` roda de novo para uma versão já publicada | Se o artefato local for idêntico ao remoto, é um retry seguro (sucesso idempotente, nada é reenviado). Só falha com "artefato diferente" se o build local realmente divergir da release já publicada — nesse caso, publique uma versão nova com `versionCode` maior. |
| `android:release:publish` falha com "versionCode não é maior" | O bucket já tem uma release com `versionCode` igual/maior; corrija `android/version.json`. |
| `/api/releases/android/latest` responde 503 `RELEASES_NOT_CONFIGURED` | Bucket ainda não provisionado/configurado na API; endpoints de release ficam desligados sem quebrar o resto da API. |
| `/api/releases/android/:version` responde 400 `INVALID_VERSION` | Versão deve ser exatamente `0.x.y`; qualquer outro formato (incluindo tentativas de path traversal) é rejeitado antes de tocar o storage. |

## Rollback

Reverta o commit desta unidade com `git revert <commit>`. Nenhuma infraestrutura Railway,
keystore ou release real foi criada; o bucket (se já existir por ação manual) e qualquer
objeto nele publicado não são afetados pelo revert do código.
