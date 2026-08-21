# Google Play - Revisão de Acesso a Notificações

Data da auditoria: 2026-08-21.

## Evidência AS-IS

- Manifesto declara `NotificationListenerService` com `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` em `apps/web/android/app/src/main/AndroidManifest.xml`.
- A tela `Captura por notificações` exibe disclosure antes de abrir Settings Android quando o acesso ainda não está concedido.
- O texto informa leitura de título e texto, apps escolhidos, finalidade financeira, envio seguro ao servidor, revisão humana, desligamento, remoção de apps e apagar histórico.
- O disclosure contém link para a Política de Privacidade em `/privacy-policy`.
- A captura é opcional e depende de ação afirmativa separada: abrir Settings Android, conceder acesso, ligar captura e escolher apps monitorados.
- Nenhum app é monitorado por padrão.
- Apps não escolhidos são tratados localmente apenas como observados: nome/pacote e última vez visto; conteúdo não é armazenado nem enviado.
- A sincronização envia ao backend somente itens da fila nativa e somente para `monitoredPackages`.
- O backend rejeita ingestão se o device estiver revogado, captura desligada ou pacote não monitorado.
- Capturas no backend expiram em 90 dias para histórico não confirmado, com purga em ingestão e endpoint de purge.
- “Desativar e apagar histórico” purga fila local e remove histórico não confirmado no servidor.
- Confirmação de notificação sempre cria lançamento após revisão humana; nada vira lançamento automaticamente.

## Riscos de review

- **RESOLVIDO:** o disclosure aponta para a rota pública `/privacy-policy`.
- **P1:** confirmar a URL HTTPS final após deploy do Web PRD antes de preencher o Play Console.
- **P1:** capturas confirmadas permanecem vinculadas ao lançamento financeiro; isso precisa estar claro na política e na exclusão de conta.
- **P1:** o reviewer pode exigir roteiro claro para gerar uma notificação de app monitorado durante teste.

## Roteiro para reviewer

1. Instalar build de teste pelo Google Play.
2. Criar conta com dados fictícios.
3. Abrir `Mais > Captura por notificações`.
4. Ler o disclosure antes de tocar em `Ativar acesso`.
5. Conceder acesso ao PlannerFin nas configurações Android.
6. Voltar ao app, tocar em `Ligar captura`.
7. Abrir `Gerenciar apps` e monitorar um app de teste ou app financeiro disponível no dispositivo.
8. Gerar uma notificação desse app.
9. Voltar ao PlannerFin e abrir `Para revisar`.
10. Confirmar que a notificação aparece como candidata e exige revisão humana.
11. Testar `Desligar captura` e `Desativar e apagar histórico`.

## Conclusão

O desenho técnico da captura está alinhado com consentimento granular e revisão humana, e a Política de Privacidade agora está acessível dentro do app. A submissão Play ainda depende da exclusão permanente de conta/dados e da confirmação da URL HTTPS final após deploy.
