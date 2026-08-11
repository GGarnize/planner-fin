<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { DashboardResponse } from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';

const civilMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const month = ref(civilMonth());
const snapshot = ref<DashboardResponse | null>(null);
const loading = ref(false);
const error = ref('');
const money = (value: string) => {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  return match
    ? `${match[1]}R$ ${match[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[3]}`
    : value;
};
const monthLabel = () => {
  const [year, value] = month.value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, value! - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
async function load() {
  loading.value = true;
  error.value = '';
  snapshot.value = null;
  try {
    const response = await authenticatedFetch(
      `/dashboard?month=${encodeURIComponent(month.value)}`,
    );
    if (!response.ok) throw new Error('Não foi possível carregar o dashboard.');
    snapshot.value = (await response.json()) as DashboardResponse;
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : 'API indisponível. Tente novamente.';
  } finally {
    loading.value = false;
  }
}
function move(offset: -1 | 1) {
  const [year, value] = month.value.split('-').map((part) => parseInt(part, 10));
  const date = new Date(Date.UTC(year!, value! - 1 + offset, 1));
  month.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  void load();
}
function current() {
  month.value = civilMonth();
  void load();
}
onMounted(load);
</script>

<template>
  <main class="dashboard">
    <h1 class="sr-only">Dashboard financeiro</h1>
    <header class="period-header">
      <button class="icon-button" aria-label="Mês anterior" @click="move(-1)">‹</button>
      <div>
        <strong>{{ monthLabel() }}</strong
        ><small>{{ month }}</small>
      </div>
      <button class="current-button" @click="current">Mês atual</button>
      <button class="icon-button" aria-label="Próximo mês" @click="move(1)">›</button>
    </header>
    <p v-if="loading" role="status">Carregando dashboard…</p>
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
          ><router-link to="/accounts">Ver contas</router-link>
        </section>
        <div class="quick-actions">
          <router-link
            class="primary-action"
            :to="{ path: '/transactions', query: { create: 'EXPENSE' } }"
            >+ Novo lançamento</router-link
          ><router-link to="/transfers">Transferir</router-link>
        </div>
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
          <ul>
            <li v-for="item in snapshot.upcomingTransactions" :key="item.id">
              <b>{{ item.description }}</b> · {{ item.type }} · {{ money(item.plannedAmount) }} ·
              {{ item.dueDate }} · {{ item.categoryName ?? 'Sem categoria' }}
              <em v-if="item.overdue">Vencido</em>
            </li>
          </ul>
        </section>
        <section class="panel" :class="{ exceeded: snapshot.budget?.exceeded }">
          <h2>Orçamento</h2>
          <p v-if="!snapshot.budget">Nenhum orçamento para {{ month }}</p>
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
          <router-link to="/budgets">Ver orçamentos</router-link>
        </section>
        <section class="panel">
          <h2>Faturas</h2>
          <p v-if="!snapshot.cardInvoices.length">Nenhuma fatura em aberto.</p>
          <ul>
            <li v-for="item in snapshot.cardInvoices" :key="item.invoiceId">
              <b>{{ item.cardName }}</b> · {{ item.referenceMonth }} · {{ item.status }} ·
              {{ money(item.total) }} · {{ item.dueDate }}
              <em v-if="item.projectedOverdue">Atraso projetado</em>
            </li>
          </ul>
          <router-link to="/cards">Ver cartões</router-link>
        </section>
        <section class="panel">
          <h2>Dívidas</h2>
          <p v-if="!snapshot.debtInstallments.length">Nenhuma parcela próxima.</p>
          <ul>
            <li v-for="item in snapshot.debtInstallments" :key="item.installmentId">
              <b>{{ item.creditorName }}</b> · parcela {{ item.installmentNumber }} ·
              {{ item.dueDate }} · {{ money(item.totalAmount) }} · {{ item.projectedStatus }}
            </li>
          </ul>
          <router-link to="/debts">Ver dívidas</router-link>
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
          <router-link to="/accounts">Contas</router-link
          ><router-link to="/transactions">Lançamentos</router-link
          ><router-link to="/cards">Cartões</router-link
          ><router-link to="/debts">Dívidas</router-link
          ><router-link to="/budgets">Orçamentos</router-link>
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
.period-header div {
  min-width: 10rem;
  text-align: center;
}
.period-header strong,
.period-header small {
  display: block;
}
.period-header strong {
  font-size: 1.25rem;
}
.period-header small {
  color: #64748b;
}
.icon-button {
  min-width: 2.75rem;
  padding: 0.25rem;
  font-size: 1.5rem;
}
.current-button {
  background: #e2e8f0;
  color: #334155;
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
.quick-actions a {
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  padding: 0.5rem;
  color: #155eef;
  background: #fff;
  border: 1px solid #155eef;
  border-radius: 0.6rem;
  text-decoration: none;
  font-weight: 700;
}
.quick-actions .primary-action {
  color: #fff;
  background: #155eef;
}
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.panel {
  background: #fff;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 0.3rem 1.4rem #0f172a18;
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
.panel em,
.exceeded {
  color: #b42318;
}
@media (max-width: 700px) {
  .dashboard {
    padding: 0;
  }
  .period-header {
    justify-content: space-between;
  }
  .period-header div {
    min-width: 0;
    flex: 1;
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
    color: #475569;
  }
  .position-panel strong {
    font-size: 1.35rem;
  }
  .quick-actions {
    grid-row: 2;
  }
  .summary-panel {
    grid-row: 3;
    padding: 0.75rem 1rem;
  }
  .summary-panel dl div {
    font-size: 0.875rem;
  }
  .summary-panel dl div:nth-child(even) {
    color: #475569;
  }
  .secondary-grid {
    margin-top: 0.75rem;
    gap: 0.75rem;
  }
}
</style>
