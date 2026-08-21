# Google Play - Readiness PlannerFin

Data da auditoria: 2026-08-21.

## Veredito

Status: **não upload-ready**.

O projeto está tecnicamente próximo para Internal Testing porque já usa `applicationId = com.plannerfin.app`, assinatura release local, `compileSdk = 36`, `targetSdk = 36`, fluxo AAB separado e rota pública de Política de Privacidade. Ainda há P0 bloqueantes de Play readiness antes do primeiro upload:

- ausência de exclusão permanente de conta e dados;
- Data Safety depende de confirmação de retenção, terceiros/observabilidade e exclusão;
- Play App Signing precisa ser configurado com a chave atual como app signing key para preservar upgrade sideload -> Play.

## Android AS-IS

| Item | Valor |
|---|---|
| applicationId | `com.plannerfin.app` |
| namespace | `com.plannerfin.app` |
| app label | `PlannerFin` |
| versionName | `0.1.5` |
| versionCode | `6` |
| minSdk | `24` |
| compileSdk | `36` |
| targetSdk | `36` |
| build-tools | resolvido via Android SDK local configurado |
| APK atual | `pnpm android:apk`, `pnpm android:release:build` |
| AAB Play | `pnpm android:bundle` / `pnpm android:bundle:release` |
| assinatura release | variáveis `PLANNER_FIN_KEYSTORE_FILE`, `PLANNER_FIN_KEYSTORE_PASSWORD`, `PLANNER_FIN_KEY_ALIAS`, `PLANNER_FIN_KEY_PASSWORD` |
| API PRD | `VITE_API_BASE_URL` deve ser HTTPS e terminar em `/api`; build PRD bloqueia local/LAN |

## Manifesto e permissões

- Permissão declarada: `android.permission.INTERNET`.
- Serviço sensível: `PlannerFinNotificationListenerService` com `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`.
- `MainActivity` exportada com launcher intent.
- `NotificationListenerService` exportado por exigência do binding Android, protegido por permissão de sistema.
- `allowBackup="false"`, `fullBackupContent="false"` e `dataExtractionRules` excluem shared preferences, database e files.
- Não há `usesCleartextTraffic="true"` no manifesto main/release.
- Não há permissões de câmera, microfone, localização, contatos, storage, `POST_NOTIFICATIONS` ou `QUERY_ALL_PACKAGES`.

## WebView

- Capacitor `BridgeActivity` registra plugins próprios de cookies e notificações.
- Cookies são aceitos e third-party cookies são habilitados para a WebView quando aplicável, para compatibilidade com auth cross-site.
- `capacitor.config.ts` não define `server.url`, então o bundle usa assets locais.

## Segurança e assinatura

Fingerprint da chave release atual:

```text
alias: planner-fin
algoritmo: RSA
tamanho RSA: 2048 bits
algoritmo de assinatura: SHA384withRSA
SHA-1: A0:30:17:F3:C5:61:77:69:98:94:4B:0A:58:30:1F:32:13:AF:86:8B
SHA-256: B5:2E:B5:50:A1:4A:0F:7B:4F:47:16:D3:17:80:53:67:C4:9B:64:36:29:94:6C:E2:56:EF:64:EB:E2:CF:5A:3C
```

As senhas não foram impressas nem registradas. A keystore fica fora do repositório, em configuração local do proprietário.

Estratégia obrigatória:

- usar esta chave atual como **app signing key** no Play App Signing;
- não aceitar uma nova app signing key gerada pelo Google se o objetivo for preservar upgrade sobre instalações sideloadadas já assinadas com esta chave;
- criar/usar upload key separada para uploads futuros quando o Play Console permitir;
- confirmar no Play Console que o SHA-256 da app signing key é exatamente o SHA-256 acima antes de enviar build.

Continuidade sideload -> Play: **SIM, condicionada** a o Play App Signing usar exatamente a chave atual como app signing key.

## Privacy e conta

- Criação de conta existe: `POST /auth/register`.
- Login/logout existem; logout revoga sessão.
- Exclusão permanente de conta não foi localizada na UI nem na API.
- Privacy Policy existe na rota pública `/privacy-policy`, sem exigir autenticação no router.
- URL pública esperada após deploy do Web PRD: `https://<web-prd>/privacy-policy`.
- Link in-app existe em `Mais > Sobre > Política de Privacidade`.
- Disclosure de notificações aponta para `/privacy-policy`.
- Contato de privacidade ainda usa placeholder explícito até definição do proprietário.

Classificação: **Privacy Policy READY no código**; Play readiness segue **P0 BLOCKED** por exclusão permanente de conta/dados.

## Notificações

O fluxo está documentado em `NOTIFICATION-ACCESS-REVIEW.md`.

Resumo:

- disclosure antes de Settings;
- captura opcional;
- apps selecionados explicitamente;
- apps observados/ignorados localmente;
- filtro de OTP/segredo no nativo;
- fila local nativa;
- sync autenticado;
- backend com owner e idempotência;
- retenção de 90 dias para capturas;
- apagar histórico não confirmado;
- confirmação humana antes de lançamento.

## Store readiness

Localizado/proposto:

- nome: PlannerFin;
- categoria: Finanças;
- Política de Privacidade: `/privacy-policy`;
- descrição curta/completa: proposta em `STORE-LISTING-PT-BR.md`;
- release notes de teste: proposta em `STORE-LISTING-PT-BR.md`.

Pendente do proprietário:

- e-mail de suporte;
- website;
- host/URL final de Política de Privacidade no formulário do Play Console;
- ícone 512x512;
- feature graphic 1024x500;
- screenshots reais;
- content rating;
- países, preço e declarações Play Console.

## Assets mínimos

Capturas reais necessárias:

- Home/dashboard;
- lançamentos;
- cartões/faturas;
- orçamento;
- captura por notificações;
- Para revisar.

Não usar dados reais, screenshots falsas ou dados financeiros sensíveis.

## Test strategy

### Internal Testing

- Validar instalação via Play.
- Validar Play App Signing com a chave atual.
- Validar upgrade sobre APK sideloadado.
- Validar login, logout, API PRD e captura por notificações.
- Grupo: proprietário e 1 a 3 testadores próximos.

### Closed Testing

- Preparar 12+ testadores.
- Garantir opt-in contínuo por 14 dias.
- Orientar testadores a não sair do teste durante o período.
- Manter canal de feedback e checklist funcional.
- Só solicitar acesso à produção depois do requisito ser cumprido.

## Primeiro bundle/versionCode

`versionCode = 6` pode ser usado se nunca houve upload desse package em qualquer faixa da Play. Se já houve tentativa/upload anterior, incrementar antes do próximo bundle.

## Referências Google

- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- App testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
