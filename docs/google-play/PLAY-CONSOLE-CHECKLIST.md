# Google Play - Checklist do Play Console

Data da auditoria: 2026-08-21.

Fontes Google consultadas:

- Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- App testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465

| Item | Status | Evidência / ação |
|---|---|---|
| Developer account | NEEDS OWNER INPUT | Proprietário deve criar/validar conta no Play Console. |
| App creation | NEEDS OWNER INPUT | Criar app com package `com.plannerfin.app`; não alterar package name. |
| App access | NEEDS OWNER INPUT | Informar credenciais/roteiro de teste se login bloquear review. |
| Ads | READY | Nenhum SDK de ads identificado; proprietário deve confirmar “não contém anúncios”. |
| Content rating | NEEDS OWNER INPUT | Responder questionário com base no produto real. |
| Target audience | NEEDS OWNER INPUT | Produto financeiro pessoal; provável público adulto, confirmar. |
| News | READY | Não é app de notícias. |
| Financial features declaration | NEEDS OWNER INPUT | Declarar app de finanças pessoais, sem banco, sem movimentação de dinheiro, sem aconselhamento automatizado. |
| Data Safety | BLOCKED | Matriz criada e policy pública adicionada; ainda depende de exclusão de conta, logs/backups e terceiros/observabilidade final. |
| Privacy Policy | READY | Rota pública `/privacy-policy`, sem auth, com link em `Mais` e no disclosure de notificações; privacy/support contact `plannerfin.app@gmail.com`; usar `https://<web-prd>/privacy-policy` no Play Console após deploy. |
| Account deletion | BLOCKED | App cria conta, mas não há fluxo/endpoint permanente de exclusão total. |
| Sensitive access: notification listener | READY | Disclosure técnico existe e aponta para `/privacy-policy`; reviewer ainda precisa de roteiro/test account. |
| Store listing | NEEDS OWNER INPUT | Texto inicial proposto em `STORE-LISTING-PT-BR.md`; assets reais faltam. |
| Countries/regions | NEEDS OWNER INPUT | Proprietário define disponibilidade. |
| Pricing | NEEDS OWNER INPUT | Proprietário define grátis/pago; não há billing no app. |
| Play App Signing | NEEDS OWNER INPUT | Usar chave atual como app signing key para preservar upgrade sideload -> Play. |
| App integrity | NEEDS OWNER INPUT | Configurar após app criado. |
| Internal Testing | READY | AAB pode ser gerado localmente; upload deve ser feito pelo proprietário. |
| Closed Testing | NEEDS OWNER INPUT | Conta pessoal nova: 12 testadores opt-in por 14 dias contínuos antes de produção. |
| Production access | BLOCKED | Depende de Closed Testing, políticas e blockers P0. |

## Play App Signing - passo crítico

Para preservar atualização de APK sideloadado para instalação futura pela Play:

1. No primeiro setup do Play App Signing, não aceitar silenciosamente uma nova app signing key gerada pelo Google.
2. Escolher a opção de fornecer a chave existente como **app signing key**.
3. Usar o fluxo do Play Console para `Provide a copy of your app signing key`, seguindo as instruções oficiais com PEPK.
4. Criar uma **upload key** separada para uploads futuros, se o Play Console oferecer/solicitar.
5. Depois do setup, comparar os fingerprints exibidos pelo Play Console para app signing key com a chave atual documentada nesta auditoria.
6. Só fazer upload se o SHA-256 da app signing key no Play Console for o mesmo da chave atual.

## Internal Testing

- Objetivo: validar instalação via Play, assinatura entregue pela Play, upgrade sobre APK sideloadado, login, captura por notificações e distribuição sem sideload.
- Grupo inicial: proprietário e 1 a 3 testadores próximos.
- Não publicar em produção.

## Closed Testing

- Preparar 12+ e-mails.
- Enviar opt-in e orientar testadores a permanecerem no teste por 14 dias contínuos.
- Manter canal de feedback.
- Só solicitar acesso à produção depois de cumprir os critérios do Play Console.
