# Google Play - Matriz Data Safety

Data da auditoria: 2026-08-21.

Fontes principais no código: `apps/api/prisma/schema.prisma`, `apps/api/src/auth`, `apps/api/src/notifications`, `apps/web/src/pages/NotificationsPage.vue`, `apps/web/src/notification-sync.ts`.

Status geral: **BLOQUEADO para submissão** até existir Política de Privacidade pública, fluxo/URL de exclusão de conta e decisão explícita de retenção para dados financeiros após exclusão.

| Tipo de dado | Coletado? | Compartilhado? | Obrigatório/opcional? | Finalidade | Transmissão | Criptografado em trânsito? | Usuário pode excluir? | Retenção | Origem no código |
|---|---:|---:|---|---|---|---|---|---|---|
| Nome | Sim | Não evidenciado | Obrigatório para conta | Identificação da conta | API | Sim, build PRD exige HTTPS | **P0: sem fluxo de exclusão de conta** | Indefinida | `User.name`, `AuthService.register` |
| E-mail | Sim | Não evidenciado | Obrigatório para conta/login | Autenticação e identificação | API | Sim, build PRD exige HTTPS | **P0: sem fluxo de exclusão de conta** | Indefinida | `User.email`, `User.normalizedEmail` |
| Senha | Sim, como hash | Não evidenciado | Obrigatório para conta | Autenticação | API | Sim, build PRD exige HTTPS | **P0: sem fluxo de exclusão de conta** | Indefinida | `User.passwordHash`, `hashPassword` |
| IDs de usuário/sessão | Sim | Não evidenciado | Obrigatório | Autenticação, isolamento por usuário, sessões | API/cookies | Sim, build PRD exige HTTPS | Sessão pode ser revogada por logout; conta não | Refresh token: 30 dias por configuração; usuário indefinido | `Session`, `AuthController.logout` |
| Dados financeiros de contas | Sim | Não evidenciado | Obrigatório para uso financeiro | Controle de contas, saldos e lançamentos | API | Sim, build PRD exige HTTPS | **P0: sem exclusão permanente de conta/dados** | Indefinida | `FinancialAccount` |
| Lançamentos, transferências, recorrências, orçamentos, cartões, dívidas | Sim | Não evidenciado | Opcional conforme uso | Gestão financeira pessoal | API | Sim, build PRD exige HTTPS | Exclusões pontuais existem em alguns módulos; exclusão total ausente | Indefinida; alguns lançamentos usam soft delete | modelos financeiros no Prisma |
| Arquivos/importações OFX/CSV e linhas de importação | Sim, se usuário importar | Não evidenciado | Opcional | Importar e revisar movimentações | API | Sim, build PRD exige HTTPS | Cancelamento/cleanup parcial; exclusão total ausente | Sessões têm `expiresAt`, mas retenção completa precisa revisão | `ImportSession`, `ImportRow`, `ImportConfirmation` |
| Conteúdo de notificações: título/texto/subText/bigText | Sim, apenas apps escolhidos | Não evidenciado | Opcional, com opt-in | Preparar candidatos financeiros para revisão humana | API após captura local | Sim, build PRD exige HTTPS | Histórico não confirmado pode ser apagado; confirmados vinculados a lançamento permanecem | 90 dias para capturas, purga de expirados; confirmados dependem de dado financeiro | `CapturedNotification`, `NotificationsService.RETENTION_MS` |
| Package names/app labels observados | Sim localmente; package name monitorado vai ao servidor | Não evidenciado | Opcional para captura | Seleção de apps monitorados e diagnóstico local | Local/API para monitorados | Sim quando enviado | Apps podem ser removidos/ignorados; exclusão total ausente | Local indefinida; servidor indefinida para `NotificationDevice` | `NotificationDevice.monitoredPackages`, `getObservedPackages` |
| Device ID do recurso de notificações | Sim | Não evidenciado | Opcional, se usar captura | Vincular dispositivo ao usuário e sincronizar fila | API | Sim, build PRD exige HTTPS | Revogação de device existe; exclusão total ausente | Indefinida para registros de device | `NotificationDevice.deviceId`, `ownerBindingId` |
| App activity | Parcial | Não evidenciado | Implícito | Autenticação, operações e estados funcionais | API | Sim, build PRD exige HTTPS | Sem export/delete total | Indefinida | timestamps `createdAt`, `updatedAt`, status de entidades |
| Diagnostics/crash/analytics | Não evidenciado no código | Não evidenciado | N/A | N/A | N/A | N/A | N/A | N/A | Não há SDK de analytics/crash report identificado em `package.json` |
| Advertising ID/anúncios | Não evidenciado | Não evidenciado | N/A | N/A | N/A | N/A | N/A | N/A | Não há SDK de ads identificado |

## Pontos que exigem proprietário

- Confirmar se há logs/observabilidade externos no Railway que armazenem IP, user-agent, payloads ou erros com dados pessoais/financeiros.
- Definir retenção e exclusão permanente de conta, incluindo backups.
- Publicar Política de Privacidade HTTPS, sem login e não PDF.
- Preencher o formulário Data Safety somente depois de confirmar terceiros efetivos e retenção real.
