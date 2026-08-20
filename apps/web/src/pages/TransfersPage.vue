<script setup lang="ts">
/* global Event, KeyboardEvent, window */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type {
  FinancialTransferStatus,
  PublicFinancialAccount,
  PublicFinancialTransfer,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { setModalScrollLock } from '../modal-scroll-lock';
import { normalizeMoney } from '../transaction-template';
type Page = { data: PublicFinancialTransfer[]; page: { limit: number; nextCursor: string | null } };
const items = ref<PublicFinancialTransfer[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]);
const loading = ref(false),
  error = ref(''),
  nextCursor = ref<string | null>(null);
const showForm = ref(false),
  editing = ref<PublicFinancialTransfer | null>(null),
  completing = ref<PublicFinancialTransfer | null>(null);
const filters = reactive({
  sourceAccountId: '',
  destinationAccountId: '',
  accountId: '',
  status: '',
  dueDateFrom: '',
  dueDateTo: '',
  completedAtFrom: '',
  completedAtTo: '',
});
const form = reactive({
  status: 'PENDING' as FinancialTransferStatus,
  sourceAccountId: '',
  destinationAccountId: '',
  description: '',
  notes: '',
  plannedAmount: '',
  actualAmount: '',
  dueDate: '',
  completedAt: '',
});
const completeForm = reactive({ actualAmount: '', completedAt: '' });
let modalHistoryActive = false;
let releasingModalHistory = false;
const androidBackState = globalThis as typeof globalThis & {
  __plannerfinSuppressNextAndroidBack?: number;
};
const activeAccounts = computed(() => accounts.value.filter((account) => !account.archivedAt));
const destinations = computed(() =>
  activeAccounts.value.filter((account) => account.id !== form.sourceAccountId),
);
watch(
  () => form.sourceAccountId,
  () => {
    if (form.destinationAccountId === form.sourceAccountId) form.destinationAccountId = '';
  },
);
const hasFilters = computed(() => Object.values(filters).some(Boolean));
const accountName = (id: string) =>
  accounts.value.find((account) => account.id === id)?.name ?? 'Conta';
const money = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]): Promise<T> {
  let response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Não foi possível concluir a operação.');
  return body as T;
}
function validateForm(): { plannedAmount: string; actualAmount: string | null } | string {
  const plannedAmount = normalizeMoney(form.plannedAmount);
  const actualAmount = form.status === 'COMPLETED' ? normalizeMoney(form.actualAmount) : null;
  if (!form.sourceAccountId) return 'Selecione a conta de origem.';
  if (!form.destinationAccountId) return 'Selecione a conta de destino.';
  if (form.sourceAccountId === form.destinationAccountId) return 'Origem e destino devem ser diferentes.';
  if (!form.description.trim()) return 'Informe a descricao.';
  if (!plannedAmount) return 'Informe um valor previsto positivo com ate duas casas decimais.';
  if (!form.dueDate) return 'Informe o vencimento.';
  if (form.status === 'COMPLETED' && !actualAmount)
    return 'Informe um valor realizado positivo com ate duas casas decimais.';
  if (form.status === 'COMPLETED' && !form.completedAt) return 'Informe a data de conclusao.';
  return { plannedAmount, actualAmount };
}
async function load(append = false) {
  loading.value = true;
  error.value = '';
  try {
    const params = new globalThis.URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (append && nextCursor.value) params.set('cursor', nextCursor.value);
    const page = await api<Page>(`/transfers?${params}`);
    items.value = append ? [...items.value, ...page.data] : page.data;
    nextCursor.value = page.page.nextCursor;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  editing.value = null;
  Object.assign(form, {
    status: 'PENDING',
    sourceAccountId: '',
    destinationAccountId: '',
    description: '',
    notes: '',
    plannedAmount: '',
    actualAmount: '',
    dueDate: '',
    completedAt: '',
  });
  showForm.value = true;
}
function openEdit(item: PublicFinancialTransfer) {
  editing.value = item;
  Object.assign(form, {
    ...item,
    notes: item.notes ?? '',
    actualAmount: item.actualAmount ?? '',
    completedAt: item.completedAt ?? '',
  });
  showForm.value = true;
}
async function save() {
  error.value = '';
  const validation = validateForm();
  if (typeof validation === 'string') {
    error.value = validation;
    return;
  }
  loading.value = true;
  const body: Record<string, unknown> = editing.value
    ? { description: form.description, notes: form.notes || null }
    : {
        ...form,
        description: form.description.trim(),
        notes: form.notes || null,
        plannedAmount: validation.plannedAmount,
        ...(form.status === 'COMPLETED' ? { actualAmount: validation.actualAmount } : {}),
      };
  if (editing.value?.status === 'PENDING')
    Object.assign(body, {
      sourceAccountId: form.sourceAccountId,
      destinationAccountId: form.destinationAccountId,
      plannedAmount: validation.plannedAmount,
      dueDate: form.dueDate,
    });
  if (!editing.value && form.status === 'PENDING') {
    delete body.actualAmount;
    delete body.completedAt;
  }
  try {
    await api(`/transfers${editing.value ? `/${editing.value.id}` : ''}`, {
      method: editing.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showForm.value = false;
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Falha ao salvar.';
  } finally {
    loading.value = false;
  }
}
async function complete() {
  if (!completing.value) return;
  error.value = '';
  const actualAmount = normalizeMoney(completeForm.actualAmount);
  if (!actualAmount) {
    error.value = 'Informe um valor realizado positivo com ate duas casas decimais.';
    return;
  }
  if (!completeForm.completedAt) {
    error.value = 'Informe a data de conclusao.';
    return;
  }
  try {
    await api(`/transfers/${completing.value.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualAmount, completedAt: completeForm.completedAt }),
    });
    completing.value = null;
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Falha ao concluir.';
  }
}
async function reopen(item: PublicFinancialTransfer) {
  try {
    await api(`/transfers/${item.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Falha ao reabrir.';
  }
}
function clearFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key as keyof typeof filters] = '';
  });
  void load();
}
function closeTopDialog(releaseHistory = true) {
  if (completing.value) {
    completing.value = null;
    if (releaseHistory) releaseModalHistory();
    return true;
  }
  if (showForm.value) {
    showForm.value = false;
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
  globalThis.history.pushState({ plannerfinModal: 'transfers' }, '', globalThis.location.href);
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
onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  window.addEventListener('popstate', onPopState);
  try {
    accounts.value = await api('/accounts');
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  }
  await load();
});
watch(
  () => showForm.value || !!completing.value,
  (active) => {
    setModalScrollLock('transfers', active);
    if (active) ensureModalHistory();
    else releaseModalHistory();
  },
);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
  window.removeEventListener('popstate', onPopState);
  modalHistoryActive = false;
  setModalScrollLock('transfers', false);
});
</script>
<template>
  <main class="transfers-page">
    <header>
      <div>
        <h1>Transferências</h1>
        <nav>
          <router-link to="/accounts">Contas</router-link> ·
          <router-link to="/transactions">Lançamentos</router-link>
        </nav>
      </div>
      <button @click="openCreate">Nova transferência</button>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load()">Tentar novamente</button>
    </p>
    <section class="filters" aria-label="Filtros">
      <select v-model="filters.sourceAccountId">
        <option value="">Todas as origens</option>
        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <select v-model="filters.destinationAccountId">
        <option value="">Todos os destinos</option>
        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <select v-model="filters.accountId">
        <option value="">Qualquer conta participante</option>
        <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <select v-model="filters.status">
        <option value="">Todos os estados</option>
        <option value="PENDING">Pendente</option>
        <option value="COMPLETED">Concluída</option>
      </select>
      <label>Vencimento inicial<input v-model="filters.dueDateFrom" type="date" /></label
      ><label>Vencimento final<input v-model="filters.dueDateTo" type="date" /></label>
      <label>Conclusão inicial<input v-model="filters.completedAtFrom" type="date" /></label
      ><label>Conclusão final<input v-model="filters.completedAtTo" type="date" /></label>
      <button @click="load()">Aplicar</button
      ><button class="secondary" @click="clearFilters">Limpar</button>
    </section>
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="!items.length" class="empty">
      <h2>
        {{ hasFilters ? 'Nenhum resultado para os filtros' : 'Nenhuma transferência cadastrada' }}
      </h2>
      <button v-if="hasFilters" @click="clearFilters">Limpar filtros</button
      ><button v-else @click="openCreate">Criar transferência</button>
    </section>
    <section v-else class="list">
      <article v-for="item in items" :key="item.id">
        <header>
          <h2>{{ item.description }}</h2>
          <span>{{ item.status === 'COMPLETED' ? 'Concluída' : 'Pendente' }}</span
          ><strong v-if="item.isOverdue">Vencida</strong>
        </header>
        <p>
          {{ accountName(item.sourceAccountId) }} → {{ accountName(item.destinationAccountId) }} ·
          vencimento {{ item.dueDate }}
        </p>
        <div class="amounts">
          <span
            >Previsto <b>{{ money(item.plannedAmount) }}</b></span
          ><span
            >Realizado <b>{{ money(item.actualAmount) }}</b></span
          >
        </div>
        <p v-if="item.completedAt">Concluída em {{ item.completedAt }}</p>
        <p v-if="item.notes">{{ item.notes }}</p>
        <div class="actions">
          <button class="secondary" @click="openEdit(item)">Editar</button
          ><button
            v-if="item.status === 'PENDING'"
            @click="
              completing = item;
              completeForm.actualAmount = item.plannedAmount;
              completeForm.completedAt = item.dueDate;
            "
          >
            Concluir</button
          ><button v-else @click="reopen(item)">Reabrir</button>
        </div>
      </article>
      <button v-if="nextCursor" :disabled="loading" @click="load(true)">Carregar mais</button>
    </section>
    <div v-if="showForm" class="modal" role="dialog" aria-modal="true">
      <form @submit.prevent="save">
        <h2>{{ editing ? 'Editar transferência' : 'Nova transferência' }}</h2>
        <div class="modal-body">
        <label
          >Origem<select
            v-model="form.sourceAccountId"
            :disabled="editing?.status === 'COMPLETED'"
            required
          >
            <option value="">Selecione</option>
            <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        ><label
          >Destino<select
            v-model="form.destinationAccountId"
            :disabled="editing?.status === 'COMPLETED'"
            required
          >
            <option value="">Selecione</option>
            <option v-for="a in destinations" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        ><label>Descrição<input v-model="form.description" maxlength="200" required /></label
        ><label>Notas<textarea v-model="form.notes" maxlength="2000" /></label
        ><label
          >Valor previsto<input
            v-model="form.plannedAmount"
            inputmode="decimal"
            :disabled="editing?.status === 'COMPLETED'"
            required /></label
        ><label
          >Vencimento<input
            v-model="form.dueDate"
            type="date"
            :disabled="editing?.status === 'COMPLETED'"
            required /></label
        ><template v-if="!editing"
          ><label
            >Estado<select v-model="form.status">
              <option value="PENDING">Pendente</option>
              <option value="COMPLETED">Concluída</option>
            </select></label
          ><template v-if="form.status === 'COMPLETED'"
            ><label
              >Valor realizado<input
                v-model="form.actualAmount"
                inputmode="decimal"
                required /></label
            ><label
              >Data de conclusão<input
                v-model="form.completedAt"
                type="date"
                required /></label></template
        ></template>
        <p v-if="editing?.status === 'COMPLETED'">
          Reabra primeiro para alterar contas, valor previsto ou vencimento.
        </p>
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="showForm = false">Cancelar</button
          ><button :disabled="loading">Salvar</button>
        </div>
      </form>
    </div>
    <div v-if="completing" class="modal" role="dialog" aria-modal="true">
      <form @submit.prevent="complete">
        <h2>Concluir transferência</h2>
        <div class="modal-body">
        <label
          >Valor realizado<input
            v-model="completeForm.actualAmount"
            inputmode="decimal"
            required /></label
        ><label
          >Data de conclusão<input v-model="completeForm.completedAt" type="date" required
        /></label>
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="completing = null">Cancelar</button
          ><button>Confirmar</button>
        </div>
      </form>
    </div>
  </main>
</template>
<style scoped>
.transfers-page {
  width: min(100%, 76rem);
  padding: 2rem;
}
.transfers-page > header,
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
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
@media (max-width: 600px) {
  .transfers-page {
    padding: 1rem;
  }
  .transfers-page > header,
  .amounts {
    align-items: stretch;
    flex-direction: column;
  }
  .actions {
    flex-wrap: wrap;
  }
}
</style>
