<script setup lang="ts">
/* eslint-disable no-undef */
import { computed, onMounted, reactive, ref } from 'vue';
import type { PublicFinancialCategory, PublicMonthlyBudget } from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';

const civilMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const month = ref(civilMonth());
const budget = ref<PublicMonthlyBudget | null>(null);
const categories = ref<PublicFinancialCategory[]>([]);
const loading = ref(false);
const saving = ref(false);
const absent = ref(false);
const error = ref('');
const editing = ref(false);
const copyMonth = ref('');
const form = reactive({
  totalLimit: '',
  notes: '',
  categories: [] as Array<{ categoryId: string; limitAmount: string }>,
});
const available = computed(() =>
  categories.value.filter(
    (category) =>
      category.type === 'EXPENSE' &&
      !category.archivedAt &&
      !form.categories.some((line) => line.categoryId === category.id),
  ),
);
const money = (value: string) => {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}R$ ${match[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[3]}`;
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    const failure = new Error(data.error?.message ?? 'Não foi possível continuar.');
    Object.assign(failure, { status: response.status, code: data.error?.code });
    throw failure;
  }
  return data as T;
}
async function load() {
  loading.value = true;
  error.value = '';
  absent.value = false;
  try {
    budget.value = await request(`/budgets?month=${encodeURIComponent(month.value)}`);
  } catch (failure) {
    if ((failure as Error & { status?: number }).status === 404) {
      budget.value = null;
      absent.value = true;
    } else error.value = (failure as Error).message;
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
function startEdit() {
  if (budget.value) {
    form.totalLimit = budget.value.totalLimit;
    form.notes = budget.value.notes ?? '';
    form.categories = budget.value.categories.map((line) => ({
      categoryId: line.categoryId,
      limitAmount: line.limitAmount,
    }));
  } else {
    form.totalLimit = '';
    form.notes = '';
    form.categories = [];
  }
  editing.value = true;
}
function addCategory(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (id && !form.categories.some((line) => line.categoryId === id))
    form.categories.push({ categoryId: id, limitAmount: '' });
  (event.target as HTMLSelectElement).value = '';
}
function categoryName(id: string) {
  return (
    budget.value?.categories.find((item) => item.categoryId === id)?.categoryName ??
    categories.value.find((item) => item.id === id)?.name ??
    id
  );
}
function isArchived(id: string) {
  return Boolean(budget.value?.categories.find((item) => item.categoryId === id)?.categoryArchived);
}
async function save() {
  saving.value = true;
  error.value = '';
  try {
    const body = {
      totalLimit: form.totalLimit,
      notes: form.notes || null,
      categories: form.categories,
      ...(!budget.value ? { month: month.value } : {}),
    };
    budget.value = await request(budget.value ? `/budgets/${budget.value.id}` : '/budgets', {
      method: budget.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    absent.value = false;
    editing.value = false;
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    saving.value = false;
  }
}
async function copy() {
  if (!budget.value || !window.confirm(`Copiar o orçamento para ${copyMonth.value}?`)) return;
  saving.value = true;
  error.value = '';
  try {
    const copied = await request<PublicMonthlyBudget>(`/budgets/${budget.value.id}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth: copyMonth.value }),
    });
    month.value = copied.month;
    budget.value = copied;
  } catch (failure) {
    error.value =
      (failure as Error & { status?: number }).status === 409
        ? 'Já existe um orçamento no mês de destino.'
        : (failure as Error).message;
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    categories.value = await request('/categories?type=EXPENSE');
  } catch {
    categories.value = [];
  }
  await load();
});
</script>

<template>
  <main class="budgets">
    <header><h1>Orçamento mensal</h1></header>
    <nav class="month-nav" aria-label="Navegação mensal">
      <button type="button" aria-label="Mês anterior" @click="move(-1)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <strong>{{ month }}</strong>
      <button type="button" aria-label="Próximo mês" @click="move(1)">
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
      <button type="button" class="current-month" @click="current">Mês atual</button>
    </nav>
    <p v-if="loading" role="status">Carregando…</p>
    <div v-if="error" role="alert">
      {{ error }} <button type="button" @click="load">Tentar novamente</button>
    </div>
    <section v-if="absent && !editing" class="panel">
      <h2>Nenhum orçamento para este mês</h2>
      <button type="button" @click="startEdit">Criar orçamento</button>
    </section>
    <form v-if="editing" class="panel" @submit.prevent="save">
      <h2>{{ budget ? 'Editar orçamento' : 'Criar orçamento' }}</h2>
      <label
        >Limite total
        <input v-model="form.totalLimit" required inputmode="decimal" placeholder="5000.00"
      /></label>
      <label>Notas <textarea v-model="form.notes" maxlength="2000" /></label>
      <label
        >Adicionar categoria
        <select @change="addCategory">
          <option value="">Selecione</option>
          <option v-for="item in available" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <fieldset>
        <legend>Limites por categoria</legend>
        <div v-for="(line, index) in form.categories" :key="line.categoryId" class="category-edit">
          <span
            >{{ categoryName(line.categoryId) }}
            <em v-if="isArchived(line.categoryId)">(arquivada)</em></span
          >
          <input
            v-model="line.limitAmount"
            required
            inputmode="decimal"
            :disabled="isArchived(line.categoryId)"
            aria-label="Limite da categoria"
          />
          <button type="button" @click="form.categories.splice(index, 1)">Remover</button>
        </div>
      </fieldset>
      <div>
        <button :disabled="saving">Salvar</button>
        <button type="button" @click="editing = false">Cancelar</button>
      </div>
    </form>
    <section v-if="budget && !editing" class="panel">
      <div class="actions">
        <button type="button" class="edit-action" @click="startEdit">
          <span class="material-icons" aria-hidden="true">edit</span>
          Editar
        </button>
      </div>
      <h2>Totais</h2>
      <div
        class="totals"
        :class="{ exceeded: budget.totals.remainingAgainstCommitted.startsWith('-') }"
      >
        <span
          >Limite <b>{{ money(budget.totalLimit) }}</b></span
        >
        <span
          >Realizado
          <b
            >{{ money(budget.totals.realizedExpense) }} ({{ budget.totals.realizedPercent }}%)</b
          ></span
        >
        <span
          >Comprometido
          <b
            >{{ money(budget.totals.committedExpense) }} ({{ budget.totals.committedPercent }}%)</b
          ></span
        >
        <span
          >Restante realizado <b>{{ money(budget.totals.remainingAgainstRealized) }}</b></span
        >
        <span
          >Restante comprometido <b>{{ money(budget.totals.remainingAgainstCommitted) }}</b></span
        >
      </div>
      <h2>Categorias</h2>
      <article
        v-for="line in budget.categories"
        :key="line.categoryId"
        :class="{ exceeded: line.remainingAgainstCommitted.startsWith('-') }"
      >
        <h3>{{ line.categoryName }} <small v-if="line.categoryArchived">Arquivada</small></h3>
        <p>
          Limite: {{ money(line.limitAmount) }} · Realizado: {{ money(line.realizedExpense) }} ({{
            line.realizedPercent
          }}%) · Comprometido: {{ money(line.committedExpense) }} ({{ line.committedPercent }}%)
        </p>
        <p>
          Restante realizado: {{ money(line.remainingAgainstRealized) }} · Restante comprometido:
          {{ money(line.remainingAgainstCommitted) }}
        </p>
      </article>
      <h2>Outras despesas</h2>
      <p>
        Sem limite específico — Realizado: {{ money(budget.totals.unbudgetedRealizedExpense) }} ·
        Comprometido: {{ money(budget.totals.unbudgetedCommittedExpense) }}
      </p>
      <p>
        Custos de dívida não categorizados — Realizado:
        {{ money(budget.totals.uncategorizedDebtCostRealized) }} · Comprometido:
        {{ money(budget.totals.uncategorizedDebtCostCommitted) }}
      </p>
      <form class="copy" @submit.prevent="copy">
        <label>Copiar para <input v-model="copyMonth" type="month" required /></label
        ><button :disabled="saving">Copiar orçamento</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.budgets {
  width: min(100%, 70rem);
  padding: 1rem;
}
nav,
.actions,
.category-edit {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}
.month-nav {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem auto;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.month-nav strong {
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  padding: 0 0.75rem;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 0.65rem;
}
.month-nav button,
.edit-action {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}
.month-nav .material-icons,
.edit-action .material-icons {
  font-size: 1.25rem;
}
.current-month {
  background: #e2e8f0;
  color: #334155;
}
.panel {
  background: white;
  padding: 1.25rem;
  border-radius: 0.75rem;
  margin-top: 1rem;
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}
.totals span {
  display: grid;
}
article {
  border-top: 1px solid #cbd5e1;
  padding: 0.75rem 0;
}
.exceeded {
  border-left: 0.35rem solid #b42318;
  padding-left: 0.75rem;
}
textarea,
select {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
}
@media (max-width: 40rem) {
  .budgets {
    padding: 0;
  }
  .month-nav {
    grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
  }
  .month-nav .current-month {
    grid-column: 1 / -1;
  }
  .category-edit {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
