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
    <header>
      <div>
        <h1>Dashboard financeiro</h1>
        <p>{{ month }}</p>
      </div>
      <nav>
        <button @click="move(-1)">Mês anterior</button><button @click="current">Mês atual</button
        ><button @click="move(1)">Próximo mês</button>
      </nav>
    </header>
    <p v-if="loading" role="status">Carregando dashboard…</p>
    <section v-else-if="error" class="panel" role="alert">
      <p>{{ error }}</p>
      <button @click="load">Tentar novamente</button>
    </section>
    <div v-else-if="snapshot" class="grid">
      <section class="panel">
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
      <section class="panel">
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
              {{ money(snapshot.budget.realizedExpense) }} ({{ snapshot.budget.realizedPercent }}%)
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
        ><router-link to="/cards">Cartões</router-link><router-link to="/debts">Dívidas</router-link
        ><router-link to="/budgets">Orçamentos</router-link>
      </section>
    </div>
  </main>
</template>

<style scoped>
.dashboard {
  width: min(100%, 75rem);
  padding: 1rem;
}
.dashboard header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.dashboard nav,
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
  padding: 1.25rem;
  box-shadow: 0 0.3rem 1.4rem #0f172a18;
}
.panel strong {
  display: block;
  font-size: 1.5rem;
  margin: 0.5rem 0;
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
  .dashboard header {
    align-items: stretch;
    flex-direction: column;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
