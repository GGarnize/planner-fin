<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import { routeLocationKey, routerKey, type RouteLocationNormalizedLoaded } from 'vue-router';
import type {
  FinancialTransactionStatus,
  FinancialTransactionType,
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicFinancialTransaction,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
const route = inject(routeLocationKey, { query: {} } as RouteLocationNormalizedLoaded);
const router = inject(routerKey, null);
type Page = {
  data: PublicFinancialTransaction[];
  page: { limit: number; nextCursor: string | null };
};
const items = ref<PublicFinancialTransaction[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]);
const loading = ref(false),
  error = ref(''),
  formError = ref(''),
  payFormError = ref(''),
  nextCursor = ref<string | null>(null),
  showForm = ref(false),
  editing = ref<PublicFinancialTransaction | null>(null),
  paying = ref<PublicFinancialTransaction | null>(null);
const filters = reactive({
  accountId: '',
  categoryId: '',
  type: '',
  status: '',
  dueDateFrom: '',
  dueDateTo: '',
  paidAtFrom: '',
  paidAtTo: '',
});
const form = reactive({
  type: 'EXPENSE' as FinancialTransactionType,
  status: 'PENDING' as FinancialTransactionStatus,
  accountId: '',
  categoryId: '',
  description: '',
  notes: '',
  plannedAmount: '',
  actualAmount: '',
  dueDate: '',
  paidAt: '',
});
const payForm = reactive({ actualAmount: '', paidAt: '' });
const compatibleCategories = computed(() =>
  categories.value.filter((c) => !c.archivedAt && c.type === form.type),
);
const money = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = Array.isArray(body.error?.details)
      ? body.error.details.find((item: unknown) =>
          Boolean(item && typeof item === 'object' && 'message' in item),
        )
      : undefined;
    throw new Error(
      (detail && typeof detail.message === 'string' && detail.message) ||
        body.error?.message ||
        'Não foi possível concluir a operação.',
    );
  }
  return response.json() as Promise<T>;
}
async function load(append = false) {
  loading.value = true;
  error.value = '';
  try {
    const params = new globalThis.URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (append && nextCursor.value) params.set('cursor', nextCursor.value);
    const page = await api<Page>(`/transactions?${params}`);
    items.value = append ? [...items.value, ...page.data] : page.data;
    nextCursor.value = page.page.nextCursor;
  } catch {
    error.value = 'API indisponível. Tente novamente.';
  } finally {
    loading.value = false;
  }
}
async function loadRelations() {
  try {
    [accounts.value, categories.value] = await Promise.all([
      api<PublicFinancialAccount[]>('/accounts'),
      api<PublicFinancialCategory[]>('/categories'),
    ]);
  } catch {
    error.value = 'API indisponível. Tente novamente.';
  }
}
function openCreate(type: FinancialTransactionType = 'EXPENSE') {
  editing.value = null;
  formError.value = '';
  Object.assign(form, {
    type,
    status: 'PENDING',
    accountId: '',
    categoryId: '',
    description: '',
    notes: '',
    plannedAmount: '',
    actualAmount: '',
    dueDate: '',
    paidAt: '',
  });
  showForm.value = true;
}
function openCreateFromRoute() {
  const type = route.query.create;
  if (type === 'INCOME' || type === 'EXPENSE') openCreate(type);
  else if (showForm.value && !editing.value) showForm.value = false;
}
function openEdit(item: PublicFinancialTransaction) {
  editing.value = item;
  formError.value = '';
  Object.assign(form, {
    ...item,
    notes: item.notes ?? '',
    actualAmount: item.actualAmount ?? '',
    paidAt: item.paidAt ?? '',
  });
  showForm.value = true;
}
function normalizeMoney(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  const match = /^(?:0|[1-9][0-9]{0,16})(?:\.([0-9]{1,2}))?$/.exec(normalized);
  if (!match || /^0(?:\.0{1,2})?$/.test(normalized)) return null;
  return `${normalized.split('.')[0]}.${(match[1] ?? '').padEnd(2, '0')}`;
}
function validateForm(): { plannedAmount: string; actualAmount?: string } | null {
  if (!form.accountId) formError.value = 'Selecione uma conta.';
  else if (!form.categoryId) formError.value = 'Selecione uma categoria.';
  else if (!compatibleCategories.value.some((category) => category.id === form.categoryId))
    formError.value = 'Selecione uma categoria compatível com a natureza do lançamento.';
  else if (!form.description.trim()) formError.value = 'Informe a descrição.';
  else if (!normalizeMoney(form.plannedAmount))
    formError.value = 'Informe um valor previsto positivo com até duas casas decimais.';
  else if (!form.dueDate) formError.value = 'Informe o vencimento.';
  else if (form.status === 'PAID' && !normalizeMoney(form.actualAmount))
    formError.value = 'Informe um valor realizado positivo com até duas casas decimais.';
  else if (form.status === 'PAID' && !form.paidAt) formError.value = 'Informe a data do pagamento.';
  else
    return {
      plannedAmount: normalizeMoney(form.plannedAmount)!,
      ...(form.status === 'PAID' ? { actualAmount: normalizeMoney(form.actualAmount)! } : {}),
    };
  return null;
}
async function save() {
  formError.value = '';
  const amounts = validateForm();
  if (!amounts) return;
  loading.value = true;
  const body: Record<string, unknown> = editing.value
    ? { description: form.description, notes: form.notes || null }
    : {
        accountId: form.accountId,
        categoryId: form.categoryId,
        type: form.type,
        status: form.status,
        description: form.description,
        notes: form.notes || null,
        plannedAmount: amounts.plannedAmount,
        dueDate: form.dueDate,
        ...(form.status === 'PAID'
          ? { actualAmount: amounts.actualAmount, paidAt: form.paidAt }
          : {}),
      };
  if (editing.value?.status === 'PENDING')
    Object.assign(body, {
      accountId: form.accountId,
      categoryId: form.categoryId,
      type: form.type,
      plannedAmount: amounts.plannedAmount,
      dueDate: form.dueDate,
    });
  try {
    await api(`/transactions${editing.value ? `/${editing.value.id}` : ''}`, {
      method: editing.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showForm.value = false;
    if (!editing.value && route.query.create) await router?.replace({ path: '/transactions' });
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Falha ao salvar.';
  } finally {
    loading.value = false;
  }
}
async function pay() {
  if (!paying.value) return;
  payFormError.value = '';
  const actualAmount = normalizeMoney(payForm.actualAmount);
  if (!actualAmount) {
    payFormError.value = 'Informe um valor realizado positivo com até duas casas decimais.';
    return;
  }
  if (!payForm.paidAt) {
    payFormError.value = 'Informe a data do pagamento.';
    return;
  }
  try {
    await api(`/transactions/${paying.value.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualAmount, paidAt: payForm.paidAt }),
    });
    paying.value = null;
    await load();
  } catch (e) {
    payFormError.value = e instanceof Error ? e.message : 'Falha ao pagar.';
  }
}
watch(
  () => form.type,
  () => {
    if (!compatibleCategories.value.some((category) => category.id === form.categoryId))
      form.categoryId = '';
  },
);
async function reopen(item: PublicFinancialTransaction) {
  try {
    await api(`/transactions/${item.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao reabrir.';
  }
}
function applyFilters() {
  nextCursor.value = null;
  void load();
}
function clearFilters() {
  Object.keys(filters).forEach((k) => (filters[k as keyof typeof filters] = ''));
  applyFilters();
}
onMounted(() => {
  void Promise.all([load(), loadRelations()]);
  openCreateFromRoute();
});
watch(() => route.query.create, openCreateFromRoute);
function closeCreate() {
  showForm.value = false;
  if (route.query.create) void router?.replace({ path: '/transactions' });
}
</script>
<template>
  <main class="transactions-page">
    <header>
      <div>
        <h1>Lançamentos</h1>
        <nav>
          <router-link to="/accounts">Contas</router-link> ·
          <router-link to="/categories">Categorias</router-link>
          · <router-link to="/transfers">Transferências</router-link>
        </nav>
      </div>
      <div class="actions">
        <button @click="openCreate('INCOME')">Nova receita</button
        ><button @click="openCreate('EXPENSE')">Nova despesa</button>
      </div>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load()">Tentar novamente</button>
    </p>
    <section class="filters" aria-label="Filtros">
      <select v-model="filters.accountId">
        <option value="">Todas as contas</option>
        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option></select
      ><select v-model="filters.categoryId">
        <option value="">Todas as categorias</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select
      ><select v-model="filters.type">
        <option value="">Receitas e despesas</option>
        <option value="INCOME">Receitas</option>
        <option value="EXPENSE">Despesas</option></select
      ><select v-model="filters.status">
        <option value="">Todos os estados</option>
        <option value="PENDING">Pendente</option>
        <option value="PAID">Pago</option></select
      ><label>Vencimento inicial<input v-model="filters.dueDateFrom" type="date" /></label
      ><label>Vencimento final<input v-model="filters.dueDateTo" type="date" /></label
      ><button @click="applyFilters">Aplicar</button
      ><button class="secondary" @click="clearFilters">Limpar</button>
    </section>
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="!items.length" class="empty">
      <h2>
        {{
          Object.values(filters).some(Boolean)
            ? 'Nenhum resultado para os filtros'
            : 'Nenhum lançamento cadastrado'
        }}
      </h2>
      <button v-if="Object.values(filters).some(Boolean)" @click="clearFilters">
        Limpar filtros</button
      ><button v-else @click="openCreate()">Criar lançamento</button>
    </section>
    <section v-else class="list">
      <article v-for="item in items" :key="item.id">
        <header>
          <h2>{{ item.description }}</h2>
          <span>{{ item.status === 'PAID' ? 'Pago' : 'Pendente' }}</span
          ><strong v-if="item.isOverdue">Vencido</strong>
        </header>
        <p>{{ item.type === 'INCOME' ? 'Receita' : 'Despesa' }} · vencimento {{ item.dueDate }}</p>
        <div class="amounts">
          <span
            >Previsto <b>{{ money(item.plannedAmount) }}</b></span
          ><span
            >Realizado <b>{{ money(item.actualAmount) }}</b></span
          >
        </div>
        <p v-if="item.notes">{{ item.notes }}</p>
        <div class="actions">
          <button class="secondary" @click="openEdit(item)">Editar</button
          ><button
            v-if="item.status === 'PENDING'"
            @click="
              paying = item;
              payFormError = '';
              payForm.actualAmount = item.plannedAmount;
              payForm.paidAt = item.dueDate;
            "
          >
            Marcar como pago</button
          ><button v-else @click="reopen(item)">Reabrir para pendente</button>
        </div>
      </article>
    </section>
    <button v-if="nextCursor" :disabled="loading" @click="load(true)">Carregar mais</button>
    <div v-if="showForm" class="modal" role="dialog" aria-modal="true">
      <form novalidate @submit.prevent="save">
        <h2>{{ editing ? 'Editar lançamento' : 'Novo lançamento' }}</h2>
        <p v-if="formError" role="alert">{{ formError }}</p>
        <label
          >Natureza<select v-model="form.type" :disabled="editing?.status === 'PAID'">
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </select></label
        ><label
          >Conta<select v-model="form.accountId" :disabled="editing?.status === 'PAID'" required>
            <option v-for="a in accounts.filter((a) => !a.archivedAt)" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select></label
        ><label
          >Categoria<select
            v-model="form.categoryId"
            :disabled="editing?.status === 'PAID'"
            required
          >
            <option v-for="c in compatibleCategories" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select></label
        ><label>Descrição<input v-model="form.description" maxlength="200" required /></label
        ><label>Notas<textarea v-model="form.notes" maxlength="2000"></textarea></label
        ><label
          >Valor previsto<input
            v-model="form.plannedAmount"
            inputmode="decimal"
            :disabled="editing?.status === 'PAID'"
            required /></label
        ><label
          >Vencimento<input
            v-model="form.dueDate"
            type="date"
            :disabled="editing?.status === 'PAID'"
            required /></label
        ><label v-if="!editing"
          >Estado<select v-model="form.status">
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
          </select></label
        ><template v-if="!editing && form.status === 'PAID'"
          ><label
            >Valor realizado<input
              v-model="form.actualAmount"
              inputmode="decimal"
              required /></label
          ><label>Data do pagamento<input v-model="form.paidAt" type="date" required /></label
        ></template>
        <p v-if="editing?.status === 'PAID'">
          Reabra primeiro para alterar conta, categoria, natureza, previsto ou vencimento.
        </p>
        <div class="actions">
          <button type="button" class="secondary" @click="closeCreate">Cancelar</button
          ><button :disabled="loading">Salvar</button>
        </div>
      </form>
    </div>
    <div v-if="paying" class="modal" role="dialog" aria-modal="true">
      <form novalidate @submit.prevent="pay">
        <h2>Marcar como pago</h2>
        <p v-if="payFormError" role="alert">{{ payFormError }}</p>
        <label
          >Valor realizado<input
            v-model="payForm.actualAmount"
            inputmode="decimal"
            required /></label
        ><label>Data do pagamento<input v-model="payForm.paidAt" type="date" required /></label>
        <div class="actions">
          <button type="button" class="secondary" @click="paying = null">Cancelar</button
          ><button>Confirmar pagamento</button>
        </div>
      </form>
    </div>
  </main>
</template>
<style scoped>
.transactions-page {
  width: min(100%, 76rem);
  padding: 2rem;
}
.transactions-page > header,
.actions,
.amounts {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
}
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
  margin: 1.5rem 0;
}
.list {
  display: grid;
  gap: 1rem;
}
.list article,
.empty,
form {
  background: #fff;
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: 0 0.5rem 2rem #0f172a18;
}
.list article > header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.list h2 {
  margin-right: auto;
}
.amounts span {
  display: grid;
}
.amounts b {
  font-size: 1.2rem;
}
.secondary {
  background: #e2e8f0;
  color: #0f172a;
}
.link {
  background: none;
  color: #b42318;
  text-decoration: underline;
}
.modal {
  position: fixed;
  inset: 0;
  background: #0f172a99;
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 3;
}
.modal form {
  width: min(100%, 34rem);
  max-height: 95vh;
  overflow: auto;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
@media (max-width: 600px) {
  .transactions-page {
    padding: 1rem;
  }
  .transactions-page > header,
  .amounts {
    align-items: stretch;
    flex-direction: column;
  }
  .actions {
    flex-wrap: wrap;
  }
}
</style>
