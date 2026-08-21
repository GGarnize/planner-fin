<template>
  <main class="privacy-page">
    <header>
      <p class="eyebrow">PlannerFin</p>
      <h1>Política de Privacidade</h1>
      <p>Vigência: 21 de agosto de 2026.</p>
    </header>

    <section>
      <h2>Responsável e contato</h2>
      <p>
        Esta política descreve como o PlannerFin trata dados no aplicativo web e Android. O contato de
        privacidade é
        <a href="mailto:plannerfin.app@gmail.com">plannerfin.app@gmail.com</a>.
      </p>
    </section>

    <section>
      <h2>Dados tratados</h2>
      <p>
        O PlannerFin trata dados de cadastro e autenticação, como nome, e-mail, senha em formato de
        hash, identificadores internos de usuário e sessão, cookies de refresh e CSRF e token de acesso
        mantido em memória durante o uso.
      </p>
      <p>
        Também trata os dados financeiros que você registra: contas, categorias, lançamentos,
        transferências, recorrências, modelos, cartões, faturas, dívidas, pagamentos, orçamentos e
        preferências visuais ou de setup.
      </p>
      <p>
        Quando você usa importação OFX/CSV, o app processa o arquivo enviado, nome sanitizado do
        arquivo, hash do arquivo, dados de mapeamento, linhas importadas, valores, datas, descrições,
        categorias, indicadores de duplicidade e confirmações de importação.
      </p>
      <p>
        No Android, se você ativar a captura por notificações, o PlannerFin pode tratar identificador
        do dispositivo, vínculo do dispositivo com sua conta, pacotes de apps monitorados, package name,
        nome do app quando disponível, título, texto, subtexto e texto expandido de notificações dos
        apps que você escolheu monitorar, hashes técnicos da notificação e classificação financeira.
      </p>
      <p>
        Para apps não escolhidos, o recurso de notificações guarda localmente apenas package name, nome
        do app quando disponível e última vez em que foi visto, para permitir que você escolha monitorar
        esse app depois. O conteúdo das notificações desses apps não é armazenado nem enviado.
      </p>
    </section>

    <section>
      <h2>Finalidades</h2>
      <p>
        Os dados são usados para criar e proteger sua conta, manter sessão autenticada, isolar dados por
        usuário, registrar e exibir informações financeiras pessoais, importar extratos, identificar
        possíveis duplicidades, sincronizar dados com a API e preparar notificações financeiras para
        revisão humana.
      </p>
      <p>
        A captura por notificações não cria lançamentos automaticamente. Ela prepara candidatos para a
        tela "Para revisar"; você decide confirmar, descartar ou marcar como não financeiro.
      </p>
    </section>

    <section>
      <h2>Armazenamento local e transmissão</h2>
      <p>
        A interface web não grava access token, refresh token ou dados financeiros em localStorage,
        sessionStorage ou IndexedDB. Preferências visuais podem ser mantidas localmente.
      </p>
      <p>
        No Android, a fila local de notificações pendentes fica em banco SQLite interno do app, com
        payload criptografado no dispositivo. Cookies são usados para autenticação e sincronização com
        a API.
      </p>
      <p>
        Dados enviados ao backend usam HTTPS em produção. Builds de produção recusam URL de API local,
        LAN ou sem HTTPS.
      </p>
    </section>

    <section>
      <h2>Infraestrutura e compartilhamento</h2>
      <p>
        O PlannerFin usa backend/API hospedado no Railway e banco PostgreSQL. Esses provedores atuam
        como infraestrutura de processamento e armazenamento. O app não possui SDK de publicidade,
        analytics ou crash reporting identificado no código atual.
      </p>
      <p>
        O PlannerFin não vende dados pessoais, dados financeiros nem conteúdo de notificações, e não
        usa esses dados para publicidade baseada no conteúdo financeiro.
      </p>
    </section>

    <section>
      <h2>Retenção</h2>
      <p>
        Dados normais da conta e dados financeiros permanecem armazenados enquanto a conta existir ou
        enquanto forem necessários para operar o serviço. A exclusão permanente de conta e dados ainda
        não está implementada no produto atual.
      </p>
      <p>
        Sessões de refresh expiram em até 30 dias e podem ser revogadas no logout. O token de acesso é
        de curta duração e permanece em memória.
      </p>
      <p>
        Importações abertas expiram em 7 dias. Sessões canceladas, expiradas ou com falha podem ter
        linhas não confirmadas apagadas pelo cleanup depois de 24 horas. Após confirmação, os
        lançamentos criados passam a fazer parte dos dados financeiros da conta.
      </p>
      <p>
        Notificações capturadas no backend têm prazo técnico de expiração de 90 dias. O usuário pode
        apagar o histórico não confirmado pela tela de captura. Notificações confirmadas ficam
        vinculadas ao lançamento financeiro criado.
      </p>
      <p>
        A fila local Android de notificações pendentes expira em 7 dias e também pode ser limpa ao
        desligar a captura e apagar histórico. Apps observados localmente e não ignorados expiram após
        30 dias; apps ignorados permanecem localmente para que não voltem a aparecer até você restaurar
        ou limpar os dados do app.
      </p>
      <p>
        A retenção operacional de logs, métricas e backups depende da configuração vigente da
        infraestrutura Railway e ainda deve ser confirmada pelo proprietário antes de preencher o Data
        Safety final.
      </p>
    </section>

    <section>
      <h2>Controle do usuário</h2>
      <p>
        Você pode sair da conta para revogar a sessão atual. Na captura por notificações, você pode
        desligar a captura, remover apps monitorados, revogar o acesso nas configurações do Android e
        apagar histórico não confirmado.
      </p>
      <p>
        Como a exclusão permanente de conta ainda não está disponível no app, solicitações de exclusão
        dependem do contato de privacidade informado nesta política.
      </p>
    </section>

    <section>
      <h2>Segurança</h2>
      <p>
        O PlannerFin aplica autenticação, cookies HttpOnly para refresh, CSRF, isolamento por usuário
        no backend, hashes para senhas e tokens opacos, validações de entrada na API e HTTPS em
        produção. Nenhuma medida elimina todos os riscos, mas o projeto evita armazenar segredos no
        bundle web ou Android.
      </p>
    </section>

    <section>
      <h2>Alterações nesta política</h2>
      <p>
        Esta política pode ser atualizada quando o produto, infraestrutura, retenção, exclusão de conta
        ou requisitos legais mudarem. A versão publicada deve refletir o comportamento real do código
        e da operação vigente.
      </p>
    </section>
  </main>
</template>

<style scoped>
.privacy-page {
  width: min(100%, 46rem);
  margin: 0 auto;
  padding-bottom: 2rem;
  line-height: 1.6;
}
.privacy-page header,
.privacy-page section {
  margin-bottom: 1.25rem;
}
.privacy-page h1 {
  margin: 0.1rem 0 0.5rem;
  font-size: 2rem;
}
.privacy-page h2 {
  margin: 0 0 0.45rem;
  font-size: 1.15rem;
}
.privacy-page p {
  margin: 0.45rem 0;
}
.eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
}
</style>
