<script setup lang="ts">
/* global CustomEvent, Event, KeyboardEvent, window */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { DashboardResponse } from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { loadInitialSetup, setupState, skipInitialSetup } from '../initial-setup';
import PanelActionLink from '../components/PanelActionLink.vue';

const civilMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const month = ref(civilMonth());
const selectedMonth = ref(month.value);
const snapshot = ref<DashboardResponse | null>(null);
const loading = ref(false);
const error = ref('');
const pickerOpen = ref(false);
const setupOfferHidden = ref(false);
let loadRequest = 0;
const money = (value: string) => {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  return match
    ? `${match[1]}R$ ${match[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[3]}`
    : value;
};
const parseMonth = (value: string) => {
  const [year, monthValue] = value.split('-').map(Number);
  return { year: year!, monthValue: monthValue! };
};
const formatMonth = (year: number, monthValue: number) =>
  `${year}-${String(monthValue).padStart(2, '0')}`;
function formatReferenceMonth(value: string) {
  const [year, monthValue] = value.split('-').map(Number);
  if (!year || !monthValue) return 'Mês não reconhecido';
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, monthValue - 1, 1)))
    .replace('.', '')
    .replace(' de ', '/');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function formatShortDate(value: string) {
  const [year, monthValue, day] = value.split('-').map(Number);
  if (!year || !monthValue || !day) return 'data não reconhecida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, monthValue - 1, day)))
    .replace('.', '')
    .replace(' de ', ' ');
}
function invoiceStatusLabel(status: DashboardResponse['cardInvoices'][number]['status']) {
  const labels: Record<DashboardResponse['cardInvoices'][number]['status'], string> = {
    OPEN: 'Aberta',
    CLOSED: 'Fechada',
  };
  return labels[status] ?? 'Status não reconhecido';
}
function transactionTypeLabel(type: DashboardResponse['upcomingTransactions'][number]['type']) {
  const labels: Record<DashboardResponse['upcomingTransactions'][number]['type'], string> = {
    INCOME: 'Receita',
    EXPENSE: 'Despesa',
  };
  return labels[type] ?? 'Tipo não reconhecido';
}
function debtProjectedStatusLabel(
  status: DashboardResponse['debtInstallments'][number]['projectedStatus'],
) {
  const labels: Record<DashboardResponse['debtInstallments'][number]['projectedStatus'], string> = {
    PENDING: 'Pendente',
    OVERDUE: 'Vencida',
  };
  return labels[status] ?? 'Status não reconhecido';
}
const addMonth = (value: string, offset: -1 | 1) => {
  const { year, monthValue } = parseMonth(value);
  const date = new Date(Date.UTC(year, monthValue - 1 + offset, 1));
  return formatMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
};
const monthLabel = computed(() => {
  const { year, monthValue } = parseMonth(month.value);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthValue - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
});
const isCurrentMonth = computed(() => month.value === civilMonth());
async function load() {
  const request = ++loadRequest;
  loading.value = true;
  error.value = '';
  snapshot.value = null;
  try {
    const response = await authenticatedFetch(
      `/dashboard?month=${encodeURIComponent(month.value)}`,
    );
    if (!response.ok) throw new Error('Não foi possível carregar o dashboard.');
    const data = (await response.json()) as DashboardResponse;
    if (request === loadRequest) snapshot.value = data;
  } catch (failure) {
    if (request !== loadRequest) return;
    error.value = failure instanceof Error ? failure.message : 'API indisponível. Tente novamente.';
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}
function move(offset: -1 | 1) {
  pickerOpen.value = false;
  month.value = addMonth(month.value, offset);
  selectedMonth.value = month.value;
  void load();
}
function current() {
  pickerOpen.value = false;
  month.value = civilMonth();
  selectedMonth.value = month.value;
  void load();
}
function openPicker() {
  selectedMonth.value = month.value;
  pickerOpen.value = true;
}
function applyPicker() {
  if (!/^\d{4}-\d{2}$/.test(selectedMonth.value)) return;
  pickerOpen.value = false;
  if (selectedMonth.value === month.value) return;
  month.value = selectedMonth.value;
  void load();
}
function closePicker() {
  pickerOpen.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !pickerOpen.value) return;
  event.preventDefault();
  closePicker();
}
function onAndroidBack(event: Event) {
  if (!pickerOpen.value) return;
  event.preventDefault();
  closePicker();
}
function startNewTransaction(event: Event) {
  window.dispatchEvent(
    new CustomEvent('plannerfin:new-transaction', {
      detail: { trigger: event.currentTarget },
    }),
  );
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  void load().then(() => {
    if (import.meta.env.MODE !== 'test') void loadInitialSetup();
  });
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
});
async function skipSetup() {
  await skipInitialSetup();
  setupOfferHidden.value = true;
}
</script>

<template>
  <main class="dashboard">
    <h1 class="sr-only">Dashboard financeiro</h1>
    <section
      v-if="setupState.data?.eligible && !setupOfferHidden"
      class="panel setup-offer"
      aria-labelledby="setup-offer-title"
    >
      <div>
        <h2 id="setup-offer-title">Setup inicial</h2>
        <p>Configure uma conta principal e categorias sugeridas quando quiser.</p>
      </div>
      <div>
        <router-link to="/setup">Configurar agora</router-link>
        <button type="button" class="secondary" @click="skipSetup">Fazer manualmente</button>
        <button type="button" class="link" @click="setupOfferHidden = true">Fechar</button>
      </div>
    </section>
    <header class="period-header">
      <button class="icon-button" aria-label="Mês anterior" @click="move(-1)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <div class="period-center">
        <button
          type="button"
          class="period-label"
          :aria-expanded="pickerOpen"
          aria-controls="dashboard-period-picker"
          @click="openPicker"
        >
          <strong>{{ monthLabel }}</strong
          ><span class="material-icons period-label__icon" aria-hidden="true">{{
            pickerOpen ? 'expand_less' : 'expand_more'
          }}</span>
        </button>
        <form
          v-if="pickerOpen"
          id="dashboard-period-picker"
          class="period-picker"
          aria-label="Selecionar mês do dashboard"
          @submit.prevent="applyPicker"
        >
          <label
            >Mês e ano
            <input v-model="selectedMonth" type="month" required />
          </label>
          <div>
            <button type="button" class="secondary" @click="closePicker">Cancelar</button>
            <button type="submit">Aplicar</button>
          </div>
        </form>
      </div>
      <button class="current-button" :disabled="isCurrentMonth" @click="current">Mês atual</button>
      <button class="icon-button" aria-label="Próximo mês" @click="move(1)">
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
    </header>
    <p v-if="loading" role="status">Carregando dashboard...</p>
    <section v-else-if="error" class="panel" role="alert">
      <p>{{ error }}</p>
      <button @click="load">Tentar novamente</button>
    </section>
    <div v-else-if="snapshot" class="dashboard-content">
      <div class="first-fold">
        <section class="panel position-panel">
          <h2>Posição atual</h2>
          <template
            v-if="
              snapshot.cashPosition.availableAccountCount === 0 &&
              snapshot.cashPosition.unavailableAccountCount === 0
            "
            ><p>Nenhuma conta ativa</p></template
          ><template v-else-if="snapshot.cashPosition.totalRealizedBalance === null"
            ><strong>Saldo total atual ainda não disponível</strong>
            <p>
              Há {{ snapshot.cashPosition.unavailableAccountCount }} conta(s) com posição inicial
              futura
            </p></template
          ><template v-else
            ><span>Saldo total atual</span
            ><strong>{{ money(snapshot.cashPosition.totalRealizedBalance) }}</strong></template
          ><PanelActionLink to="/accounts" icon="account_balance" label="Ver contas" />
        </section>
        <div class="quick-actions">
          <button
            class="primary-action"
            aria-label="Criar transação pelo dashboard"
            @click="startNewTransaction"
          >
            + Novo lançamento</button
          ><router-link to="/transfers">Transferir</router-link>
        </div>
        <router-link
          v-if="snapshot.counters.pendingNotificationReviews > 0"
          class="review-shortcut"
          to="/notifications/inbox"
        >
          <span class="material-icons" aria-hidden="true">rate_review</span>
          <span>
            <strong>Para revisar</strong>
            <small>
              {{ snapshot.counters.pendingNotificationReviews }}
              {{
                snapshot.counters.pendingNotificationReviews === 1
                  ? 'movimentação aguardando revisão'
                  : 'movimentações aguardando revisão'
              }}
            </small>
          </span>
          <span class="material-icons" aria-hidden="true">chevron_right</span>
        </router-link>
        <section class="panel summary-panel">
          <h2>Resumo do mês</h2>
          <dl>
            <div>
              <dt>Receitas realizadas</dt>
              <dd>{{ money(snapshot.monthlyFlow.incomeRealized) }}</dd>
            </div>
            <div>
              <dt>Receitas planejadas</dt>
              <dd>{{ money(snapshot.monthlyFlow.incomePlanned) }}</dd>
            </div>
            <div>
              <dt>Despesas realizadas</dt>
              <dd>{{ money(snapshot.monthlyFlow.expenseRealized) }}</dd>
            </div>
            <div>
              <dt>Despesas comprometidas</dt>
              <dd>{{ money(snapshot.monthlyFlow.expenseCommitted) }}</dd>
            </div>
            <div>
              <dt>Resultado realizado</dt>
              <dd>{{ money(snapshot.monthlyFlow.realizedNet) }}</dd>
            </div>
            <div>
              <dt>Resultado planejado/comprometido</dt>
              <dd>{{ money(snapshot.monthlyFlow.plannedNet) }}</dd>
            </div>
          </dl>
        </section>
      </div>
      <div class="secondary-grid">
        <section class="panel">
          <h2>Próximos lançamentos</h2>
          <p v-if="!snapshot.upcomingTransactions.length">Nenhum lançamento próximo.</p>
          <ul class="dashboard-list">
            <li v-for="item in snapshot.upcomingTransactions" :key="item.id">
              <b>{{ item.description }}</b>
              <span>
                {{ transactionTypeLabel(item.type) }} · {{ money(item.plannedAmount) }} · vence em
                {{ formatShortDate(item.dueDate) }} · {{ item.categoryName ?? 'Sem categoria' }}
              </span>
              <em v-if="item.overdue">Vencido</em>
            </li>
          </ul>
        </section>
        <section class="panel" :class="{ exceeded: snapshot.budget?.exceeded }">
          <h2>Orçamento</h2>
          <p v-if="!snapshot.budget">Nenhum orçamento para {{ formatReferenceMonth(month) }}</p>
          <dl v-else>
            <div>
              <dt>Limite</dt>
              <dd>{{ money(snapshot.budget.totalLimit) }}</dd>
            </div>
            <div>
              <dt>Realizado</dt>
              <dd>
                {{ money(snapshot.budget.realizedExpense) }} ({{
                  snapshot.budget.realizedPercent
                }}%)
              </dd>
            </div>
            <div>
              <dt>Comprometido</dt>
              <dd>
                {{ money(snapshot.budget.committedExpense) }} ({{
                  snapshot.budget.committedPercent
                }}%)
              </dd>
            </div>
            <div>
              <dt>Restante comprometido</dt>
              <dd>{{ money(snapshot.budget.remainingAgainstCommitted) }}</dd>
            </div>
          </dl>
          <PanelActionLink to="/budgets" icon="account_balance_wallet" label="Ver Orçamento" />
        </section>
        <section class="panel">
          <h2>Faturas</h2>
          <p v-if="!snapshot.cardInvoices.length">Nenhuma fatura em aberto.</p>
          <ul class="dashboard-list">
            <li v-for="item in snapshot.cardInvoices" :key="item.invoiceId">
              <b>{{ item.cardName }} · {{ formatReferenceMonth(item.referenceMonth) }}</b>
              <span>
                {{ money(item.total) }} · {{ invoiceStatusLabel(item.status) }} · vence em
                {{ formatShortDate(item.dueDate) }}
              </span>
              <em v-if="item.projectedOverdue">Atraso projetado</em>
            </li>
          </ul>
          <PanelActionLink to="/cards" icon="credit_card" label="Ver cartões" />
        </section>
        <section class="panel">
          <h2>Dívidas</h2>
          <p v-if="!snapshot.debtInstallments.length">Nenhuma parcela próxima.</p>
          <ul class="dashboard-list">
            <li v-for="item in snapshot.debtInstallments" :key="item.installmentId">
              <b>{{ item.creditorName }} · parcela {{ item.installmentNumber }}</b>
              <span>
                {{ money(item.totalAmount) }} ·
                {{ debtProjectedStatusLabel(item.projectedStatus) }} · vence em
                {{ formatShortDate(item.dueDate) }}
              </span>
            </li>
          </ul>
          <PanelActionLink to="/debts" icon="request_quote" label="Ver dívidas" />
        </section>
        <section class="panel">
          <h2>Despesas por categoria</h2>
          <p v-if="!snapshot.expenseByCategory.categories.length">Nenhuma despesa categorizada.</p>
          <ul>
            <li v-for="item in snapshot.expenseByCategory.categories" :key="item.categoryId">
              <b>{{ item.categoryName }}</b> · {{ money(item.amount) }}
            </li>
          </ul>
          <p>
            Custos de dívida não categorizados:
            {{ money(snapshot.expenseByCategory.uncategorizedDebtCostRealized) }}
          </p>
        </section>
        <section class="panel actions">
          <h2>Ações rápidas</h2>
          <PanelActionLink compact to="/accounts" icon="account_balance" label="Contas" />
          <PanelActionLink compact to="/transactions" icon="receipt_long" label="Lançamentos" />
          <PanelActionLink compact to="/cards" icon="credit_card" label="Cartões" />
          <PanelActionLink compact to="/debts" icon="request_quote" label="Dívidas" />
          <PanelActionLink compact to="/budgets" icon="account_balance_wallet" label="Orçamentos" />
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.dashboard {
  width: min(100%, 75rem);
  margin: 0 auto;
  padding: 1rem;
}
.period-header {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
.setup-offer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
.setup-offer h2,
.setup-offer p {
  margin: 0;
}
.setup-offer div:last-child {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.setup-offer a,
.setup-offer button {
  min-height: 2.75rem;
}
.period-center {
  min-width: 10rem;
  position: relative;
  text-align: center;
}
.period-label {
  width: 100%;
  min-height: 2.75rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
}
.period-label strong {
  font-size: 1.25rem;
  font-weight: 700;
}
.period-label__icon {
  color: var(--color-text-muted);
  font-size: 1.35rem;
}
.period-picker {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.35rem);
  left: 50%;
  width: min(18rem, calc(100vw - 2rem));
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-surface);
  transform: translateX(-50%);
}
.period-picker label {
  display: grid;
  gap: 0.35rem;
  text-align: left;
  font-weight: 700;
}
.period-picker input {
  min-height: 2.75rem;
  font: inherit;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
.period-picker div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.icon-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0.25rem;
  font-size: 1.5rem;
}
.current-button {
  min-height: 2.75rem;
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.current-button:disabled {
  opacity: 0.55;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.first-fold {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 0.75rem;
}
.position-panel {
  grid-column: 1;
}
.summary-panel {
  grid-column: 2;
  grid-row: 1 / span 2;
}
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  align-self: start;
}
.quick-actions a,
.quick-actions button {
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  padding: 0.5rem;
  color: var(--color-accent);
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: 0.6rem;
  text-decoration: none;
  font-weight: 700;
}
.quick-actions .primary-action {
  color: var(--color-on-accent);
  background: var(--color-accent);
}
.review-shortcut {
  grid-column: 1;
  min-height: 3.25rem;
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
  border: 1px solid var(--color-accent);
  border-radius: 0.6rem;
  text-decoration: none;
}
.review-shortcut strong,
.review-shortcut small {
  display: block;
}
.review-shortcut strong {
  margin: 0;
  font-size: 0.95rem;
}
.review-shortcut small {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.review-shortcut .material-icons {
  font-size: 1.25rem;
}
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.5rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.panel {
  background: var(--color-surface);
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: var(--shadow-surface);
}
.panel strong {
  display: block;
  font-size: 1.5rem;
  margin: 0.5rem 0;
}
.panel h2 {
  margin: 0 0 0.5rem;
}
.panel p {
  margin: 0.5rem 0;
}
.panel :deep(.panel-action-link) {
  margin-top: 0.75rem;
}
.actions :deep(.panel-action-link) {
  margin-top: 0;
}
.panel dl {
  margin: 0;
}
.panel dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.panel dd {
  font-weight: 700;
}
.panel li {
  margin: 0.55rem 0;
}
.dashboard-list {
  padding-left: 1.1rem;
}
.dashboard-list li b,
.dashboard-list li span,
.dashboard-list li em {
  display: block;
}
.dashboard-list li span {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.panel em,
.exceeded {
  color: var(--color-error);
}
@media (max-width: 700px) {
  .dashboard {
    padding: 0;
  }
  .period-header {
    justify-content: space-between;
    gap: 0.35rem;
  }
  .period-center {
    min-width: 0;
    flex: 1;
  }
  .period-label strong {
    font-size: 1rem;
  }
  .current-button {
    font-size: 0.75rem;
    padding: 0.4rem;
  }
  .first-fold,
  .secondary-grid {
    grid-template-columns: 1fr;
  }
  .position-panel,
  .summary-panel {
    grid-column: 1;
    grid-row: auto;
  }
  .position-panel {
    padding: 0.75rem 1rem;
  }
  .position-panel h2 {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .position-panel strong {
    font-size: 1.35rem;
  }
  .quick-actions {
    grid-row: 2;
  }
  .review-shortcut {
    grid-row: 3;
  }
  .summary-panel {
    grid-row: 4;
    padding: 0.75rem 1rem;
  }
  .summary-panel dl div {
    font-size: 0.875rem;
  }
  .summary-panel dl div:nth-child(even) {
    color: var(--color-text-muted);
  }
  .secondary-grid {
    margin-top: 0.75rem;
    gap: 0.75rem;
  }
}
</style>
