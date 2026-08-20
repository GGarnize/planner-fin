<script setup lang="ts">
/* global Event, KeyboardEvent, window */
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { routeLocationKey, routerKey, type RouteLocationNormalizedLoaded } from 'vue-router';
import type {
  FinancialTransactionStatus,
  FinancialTransactionType,
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicFinancialEntry,
  PublicFinancialTransaction,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { setModalScrollLock } from '../modal-scroll-lock';
import KebabMenu, { type KebabMenuAction } from '../components/KebabMenu.vue';
import { normalizeMoney } from '../transaction-template';
const route = inject(routeLocationKey, { query: {} } as RouteLocationNormalizedLoaded);
const router = inject(routerKey, null);
type Page = {
  data: PublicFinancialEntry[];
  page: { limit: number; nextCursor: string | null };
};
const entries = ref<PublicFinancialEntry[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]);
const loading = ref(false),
  error = ref(''),
  formError = ref(''),
  payFormError = ref(''),
  nextCursor = ref<string | null>(null),
  showForm = ref(false),
  editing = ref<PublicFinancialTransaction | null>(null),
  paying = ref<PublicFinancialEntry | null>(null),
  deleting = ref<PublicFinancialEntry | null>(null),
  deletingBusy = ref(false),
  deleteError = ref('');
const filtersOpen = ref(false);
function pad(value: number) {
  return String(value).padStart(2, '0');
}
function civilDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function monthBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: civilDateString(new Date(year, month + 1, 0)),
  };
}
const defaultDueMonth = monthBounds();
const filters = reactive({
  accountId: '',
  categoryId: '',
  type: '',
  status: '',
  dueDateFrom: defaultDueMonth.from,
  dueDateTo: defaultDueMonth.to,
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
let modalHistoryActive = false;
let releasingModalHistory = false;
const androidBackState = globalThis as typeof globalThis & {
  __plannerfinSuppressNextAndroidBack?: number;
};
const compatibleCategories = computed(() =>
  categories.value.filter((c) => !c.archivedAt && c.type === form.type),
);
const money = (value: string | null) => {
  if (value === null) return '—';
  const [integer = '0', cents = ''] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${grouped},${cents.padEnd(2, '0').slice(0, 2)}`;
};
function categoryName(categoryId: string) {
  return categories.value.find((c) => c.id === categoryId)?.name ?? '';
}
function cardLabel(entry: PublicFinancialEntry) {
  if (!entry.cardName) return '';
  return entry.installmentCount && entry.installmentCount > 1
    ? `${entry.cardName} · ${entry.installmentNumber}/${entry.installmentCount}`
    : entry.cardName;
}
const MONTH_ABBR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
function shortDate(date: string) {
  const [, month, day] = date.split('-');
  return `${Number(day)} ${MONTH_ABBR[Number(month) - 1]}`;
}
type EntryGroup = { key: 'today' | 'future' | 'past'; title: string; items: PublicFinancialEntry[] };
const groupedItems = computed<EntryGroup[]>(() => {
  const today = civilDateString();
  const groups: EntryGroup[] = [
    { key: 'today', title: 'Hoje', items: [] },
    { key: 'future', title: 'Futuros', items: [] },
    { key: 'past', title: 'Anteriores', items: [] },
  ];
  for (const entry of entries.value) {
    if (entry.date === today) groups[0]!.items.push(entry);
    else if (entry.date > today) groups[1]!.items.push(entry);
    else groups[2]!.items.push(entry);
  }
  groups[1]!.items.sort(
    (a, b) => a.date.localeCompare(b.date) || b.createdAt.localeCompare(a.createdAt),
  );
  return groups.filter((group) => group.items.length);
});
function actionsFor(entry: PublicFinancialEntry): KebabMenuAction[] {
  if (entry.source === 'CARD_INSTALLMENT') {
    return [
      { label: 'Ver no cartão', onSelect: () => goToCard(entry.cardId!) },
      { label: 'Excluir', danger: true, onSelect: () => openDelete(entry) },
    ];
  }
  return [
    entry.status === 'PENDING'
      ? { label: 'Marcar como pago', onSelect: () => openPay(entry) }
      : { label: 'Reabrir para pendente', onSelect: () => reopen(entry) },
    { label: 'Excluir', danger: true, onSelect: () => openDelete(entry) },
  ];
}
function openPay(entry: PublicFinancialEntry) {
  paying.value = entry;
  payFormError.value = '';
  payForm.actualAmount = entry.amount;
  payForm.paidAt = entry.date;
}
function goToCard(cardId: string) {
  void router?.push(`/cards/${cardId}`);
}
function activateEntry(entry: PublicFinancialEntry) {
  if (entry.source === 'CARD_INSTALLMENT') goToCard(entry.cardId!);
  else void openEdit(entry);
}
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(safeApiErrorMessage(body, 'Não foi possível concluir a operação.'));
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
    const page = await api<Page>(`/financial-entries?${params}`);
    entries.value = append ? [...entries.value, ...page.data] : page.data;
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
  if (router && typeof router.push === 'function') {
    void router.push({ path: '/transactions/new', query: { type } });
    return;
  }
  editing.value = null;
  formError.value = '';
  const activeAccounts = accounts.value.filter((account) => !account.archivedAt);
  const activeCompatibleCategories = categories.value.filter(
    (category) => !category.archivedAt && category.type === type,
  );
  Object.assign(form, {
    type,
    status: 'PENDING',
    accountId: activeAccounts.length === 1 ? activeAccounts[0]!.id : '',
    categoryId: activeCompatibleCategories.length === 1 ? activeCompatibleCategories[0]!.id : '',
    description: '',
    notes: '',
    plannedAmount: '',
    actualAmount: '',
    dueDate: civilDateString(),
    paidAt: '',
  });
  showForm.value = true;
}
function openCreateFromRoute() {
  const type = route.query.create;
  if (type === 'INCOME' || type === 'EXPENSE') openCreate(type);
  else if (showForm.value && !editing.value) showForm.value = false;
}
async function openEdit(entry: PublicFinancialEntry) {
  formError.value = '';
  try {
    const item = await api<PublicFinancialTransaction>(`/transactions/${entry.sourceId}`);
    editing.value = item;
    Object.assign(form, {
      ...item,
      notes: item.notes ?? '',
      actualAmount: item.actualAmount ?? '',
      paidAt: item.paidAt ?? '',
    });
    showForm.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Não foi possível abrir o lançamento.';
  }
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
    await api(`/transactions/${paying.value.sourceId}/pay`, {
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
async function removeTransaction() {
  if (!deleting.value || deletingBusy.value) return;
  const entry = deleting.value;
  deleteError.value = '';
  deletingBusy.value = true;
  const path =
    entry.source === 'CARD_INSTALLMENT'
      ? `/card-purchases/${entry.purchaseId}`
      : `/transactions/${entry.sourceId}`;
  const fallbackMessage =
    entry.source === 'CARD_INSTALLMENT'
      ? 'Não foi possível excluir a compra.'
      : 'Não foi possível excluir o lançamento.';
  try {
    const response = await authenticatedFetch(path, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(safeApiErrorMessage(body, fallbackMessage));
    }
    deleting.value = null;
    await load();
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : fallbackMessage;
  } finally {
    deletingBusy.value = false;
  }
}
function openDelete(entry: PublicFinancialEntry) {
  deleteError.value = '';
  deletingBusy.value = false;
  deleting.value = entry;
}
function cancelDelete() {
  deleteError.value = '';
  deleting.value = null;
}
watch(
  () => form.type,
  () => {
    if (!compatibleCategories.value.some((category) => category.id === form.categoryId))
      form.categoryId = '';
    if (!form.categoryId && compatibleCategories.value.length === 1)
      form.categoryId = compatibleCategories.value[0]!.id;
  },
);
watch(
  () => showForm.value || !!paying.value || !!deleting.value,
  (active) => {
    setModalScrollLock('transactions', active);
    if (active) ensureModalHistory();
    else releaseModalHistory();
  },
);
async function reopen(entry: PublicFinancialEntry) {
  try {
    await api(`/transactions/${entry.sourceId}/reopen`, {
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
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  window.addEventListener('popstate', onPopState);
  void Promise.all([load(), loadRelations()]);
  openCreateFromRoute();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
  window.removeEventListener('popstate', onPopState);
  modalHistoryActive = false;
  setModalScrollLock('transactions', false);
});
watch(() => route.query.create, openCreateFromRoute);
function closeCreate() {
  showForm.value = false;
  if (route.query.create) void router?.replace({ path: '/transactions' });
}
function closeTopDialog(releaseHistory = true) {
  if (paying.value) {
    paying.value = null;
    if (releaseHistory) releaseModalHistory();
    return true;
  }
  if (deleting.value) {
    deleting.value = null;
    deleteError.value = '';
    if (releaseHistory) releaseModalHistory();
    return true;
  }
  if (showForm.value) {
    closeCreate();
    if (releaseHistory) releaseModalHistory();
    return true;
  }
  return false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && closeTopDialog()) event.preventDefault();
}
function onAndroidBack(event: Event) {
  if (!closeTopDialog()) return;
  event.preventDefault();
}
function ensureModalHistory() {
  if (modalHistoryActive) return;
  modalHistoryActive = true;
  globalThis.history.pushState({ plannerfinModal: 'transactions' }, '', globalThis.location.href);
}
function releaseModalHistory() {
  if (!modalHistoryActive || releasingModalHistory) return;
  modalHistoryActive = false;
  releasingModalHistory = true;
  globalThis.history.back();
  globalThis.setTimeout(() => {
    releasingModalHistory = false;
  }, 0);
}
function onPopState() {
  if (releasingModalHistory || !modalHistoryActive) return;
  modalHistoryActive = false;
  closeTopDialog(false);
  androidBackState.__plannerfinSuppressNextAndroidBack = Date.now() + 1000;
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
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load()">Tentar novamente</button>
    </p>
    <div class="filter-summary">
      <button class="secondary" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
        Filtros {{ Object.values(filters).some(Boolean) ? 'ativos' : '' }}
      </button>
      <button v-if="Object.values(filters).some(Boolean)" class="link" @click="clearFilters">
        Limpar filtros
      </button>
    </div>
    <section v-show="filtersOpen" class="filters" aria-label="Filtros avançados">
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
    <p v-if="filters.accountId || filters.status || filters.paidAtFrom || filters.paidAtTo" class="hint">
      Compras no cartão ficam ocultas quando filtros de conta, status ou data de pagamento estão ativos.
    </p>
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="!entries.length" class="empty">
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
    <section v-else class="list" aria-label="Lançamentos filtrados">
      <section v-for="group in groupedItems" :key="group.key" class="date-group">
        <h2>{{ group.title }}</h2>
        <article
          v-for="entry in group.items"
          :key="entry.id"
          class="transaction-card"
          :class="{
            'transaction-card--paid': entry.status === 'PAID',
            'transaction-card--pending': entry.status === 'PENDING',
            'transaction-card--purchase': entry.source === 'CARD_INSTALLMENT',
          }"
        >
          <button type="button" class="entry-tap" @click="activateEntry(entry)">
            <span class="entry-top">
              <h3>{{ entry.description }}</h3>
              <span class="entry-amount">{{ entry.type === 'INCOME' ? '+' : '-' }} {{ money(entry.amount) }}</span>
            </span>
            <span class="entry-meta">
              {{ shortDate(entry.date) }} ·
              <span v-if="entry.source === 'TRANSACTION'" class="status-badge">{{
                entry.status === 'PAID' ? 'Pago' : 'Pendente'
              }}</span>
              <span v-else class="status-badge status-badge--card">{{ cardLabel(entry) }}</span>
              <strong v-if="entry.overdue"> · Vencido</strong>
            </span>
            <span v-if="categoryName(entry.categoryId)" class="entry-category">{{
              categoryName(entry.categoryId)
            }}</span>
          </button>
          <KebabMenu
            class="entry-kebab"
            :label="`Ações de ${entry.description}`"
            :actions="actionsFor(entry)"
          />
        </article>
      </section>
    </section>
    <button v-if="nextCursor" :disabled="loading" @click="load(true)">Carregar mais</button>
    <div v-if="showForm" class="modal" role="dialog" aria-modal="true">
      <form novalidate @submit.prevent="save">
        <h2>{{ editing ? 'Editar lançamento' : 'Novo lançamento' }}</h2>
        <div class="modal-body">
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
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="closeCreate">Cancelar</button
          ><button :disabled="loading">Salvar</button>
        </div>
      </form>
    </div>
    <div v-if="paying" class="modal" role="dialog" aria-modal="true">
      <form novalidate @submit.prevent="pay">
        <h2>Marcar como pago</h2>
        <div class="modal-body">
          <p v-if="payFormError" role="alert">{{ payFormError }}</p>
          <label
            >Valor realizado<input
              v-model="payForm.actualAmount"
              inputmode="decimal"
              required /></label
          ><label>Data do pagamento<input v-model="payForm.paidAt" type="date" required /></label>
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="paying = null">Cancelar</button
          ><button>Confirmar pagamento</button>
        </div>
      </form>
    </div>
    <div
      v-if="deleting"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <form class="confirm-delete" novalidate @submit.prevent="removeTransaction">
        <h2 id="delete-title">
          {{
            deleting.source === 'CARD_INSTALLMENT'
              ? 'Excluir esta compra do cartão?'
              : deleting.isRecurringOccurrence
                ? 'Excluir somente este lançamento?'
                : 'Excluir este lançamento?'
          }}
        </h2>
        <div class="modal-body">
          <p v-if="deleteError" role="alert">{{ deleteError }}</p>
          <p>
            {{
              deleting.source === 'CARD_INSTALLMENT'
                ? deleting.installmentCount && deleting.installmentCount > 1
                  ? `Isso remove as ${deleting.installmentCount} parcelas dessa compra, não só esta, e recalcula as faturas.`
                  : 'Isso remove essa compra do cartão e recalcula a fatura.'
                : deleting.isRecurringOccurrence
                  ? 'A recorrência continuará ativa e as próximas ocorrências serão mantidas.'
                  : 'Esta ação remove o lançamento dos seus cálculos e listas.'
            }}
          </p>
        </div>
        <div class="actions">
          <button type="button" class="secondary" :disabled="deletingBusy" @click="cancelDelete">
            Cancelar</button
          ><button class="danger" :disabled="deletingBusy">
            {{ deletingBusy ? 'Excluindo...' : 'Excluir' }}
          </button>
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
.actions {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
}
.hint {
  padding: 0.6rem 0.85rem;
  margin: 0.5rem 0;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  border-radius: 0.6rem;
  font-size: 0.85rem;
}
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
  margin: 1.5rem 0;
}
.filter-summary {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 1rem 0;
}
.list {
  display: grid;
  gap: 1.25rem;
}
.date-group {
  display: grid;
  gap: 0.75rem;
}
.date-group > h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}
.list article,
.empty,
form {
  background: var(--color-surface);
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: var(--shadow-surface);
}
.transaction-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0 0.5rem;
  padding: 0.85rem 0.9rem;
  border-left: 0.3rem solid var(--color-border);
}
.transaction-card--paid {
  border-left-color: var(--color-success);
}
.transaction-card--pending {
  border-left-color: var(--color-warning);
}
.transaction-card--purchase {
  border-left-color: var(--color-accent);
}
.entry-tap {
  grid-column: 1;
  display: grid;
  gap: 0.15rem;
  width: 100%;
  text-align: left;
  background: transparent;
  color: inherit;
  font: inherit;
  border: 0;
  padding: 0;
  cursor: pointer;
  border-radius: 0.5rem;
}
.entry-tap:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.entry-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}
.entry-top h3 {
  margin: 0;
  font-size: 1rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-amount {
  flex-shrink: 0;
  font-weight: 700;
}
.entry-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.entry-meta strong {
  color: var(--color-error);
  font-weight: 700;
}
.entry-category {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.entry-kebab {
  grid-column: 2;
  grid-row: 1;
}
.status-badge {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}
.status-badge--card {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.transaction-card--paid .status-badge::before {
  content: '✓ ';
}
.transaction-card--pending .status-badge::before {
  content: '• ';
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.danger {
  background: var(--color-error);
  color: var(--color-on-accent);
}
.modal .actions button {
  min-height: 44px;
}
.link {
  background: none;
  color: var(--color-error);
  text-decoration: underline;
}
.modal {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    calc(var(--shell-nav-height, 0px) + 1rem + env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
  z-index: 90;
  overscroll-behavior: contain;
}
.modal form {
  width: min(100%, 34rem);
  max-height: calc(100dvh - var(--shell-nav-height, 0px) - 2rem - env(safe-area-inset-bottom));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}
.modal-body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding-right: 0.25rem;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
@media (max-width: 600px) {
  .transactions-page {
    padding: 1rem;
  }
  .transactions-page > header {
    align-items: stretch;
    flex-direction: column;
  }
  .actions {
    flex-wrap: wrap;
  }
  .transactions-page > header nav {
    display: none;
  }
  .filters {
    margin: 0.5rem 0 1rem;
    grid-template-columns: 1fr;
  }
  .list article {
    padding: 1rem;
  }
}
</style>
