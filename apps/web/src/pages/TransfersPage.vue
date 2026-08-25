<script setup lang="ts">
/* global Event, HTMLButtonElement, HTMLElement, KeyboardEvent, window */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import type {
  FinancialTransferStatus,
  PublicFinancialAccount,
  PublicFinancialTransfer,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import PageHeader from '../components/PageHeader.vue';
import { setModalScrollLock } from '../modal-scroll-lock';
import { normalizeMoney } from '../transaction-template';
type Page = { data: PublicFinancialTransfer[]; page: { limit: number; nextCursor: string | null } };
const router = useRouter();
const items = ref<PublicFinancialTransfer[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]);
const loading = ref(false),
  error = ref(''),
  nextCursor = ref<string | null>(null);
const showForm = ref(false),
  filtersOpen = ref(false),
  showDiscardConfirm = ref(false),
  editing = ref<PublicFinancialTransfer | null>(null),
  completing = ref<PublicFinancialTransfer | null>(null),
  discardTarget = ref<'form' | 'complete'>('form'),
  discardSource = ref<'button' | 'route' | 'history'>('button');
const moreFiltersButton = ref<HTMLButtonElement | null>(null),
  formDialog = ref<HTMLElement | null>(null),
  completeDialog = ref<HTMLElement | null>(null),
  discardDialog = ref<HTMLElement | null>(null),
  formBackButton = ref<HTMLButtonElement | null>(null);
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
const fieldErrors = reactive<Record<string, string>>({});
const completeFieldErrors = reactive<Record<string, string>>({});
const formSnapshot = ref(''),
  completeSnapshot = ref(''),
  pendingRoute = ref('');
let modalHistoryActive = false;
let releasingModalHistory = false;
let discardReturnFocus: HTMLElement | null = null;
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
const activeSecondaryFilters = computed(
  () =>
    [
      filters.sourceAccountId,
      filters.destinationAccountId,
      filters.accountId,
      filters.status,
      filters.completedAtFrom,
      filters.completedAtTo,
    ].filter(Boolean).length,
);
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length);
const filterStatusText = computed(() =>
  activeFilterCount.value === 1 ? '1 filtro ativo' : `${activeFilterCount.value} filtros ativos`,
);
const formDirty = computed(() => showForm.value && serializeForm() !== formSnapshot.value);
const completeDirty = computed(
  () => !!completing.value && serializeCompleteForm() !== completeSnapshot.value,
);
const hasUnsavedChanges = computed(() => formDirty.value || completeDirty.value);
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
function serializeForm() {
  return JSON.stringify({
    status: form.status,
    sourceAccountId: form.sourceAccountId,
    destinationAccountId: form.destinationAccountId,
    description: form.description,
    notes: form.notes,
    plannedAmount: form.plannedAmount,
    actualAmount: form.actualAmount,
    dueDate: form.dueDate,
    completedAt: form.completedAt,
  });
}
function serializeCompleteForm() {
  return JSON.stringify({
    actualAmount: completeForm.actualAmount,
    completedAt: completeForm.completedAt,
  });
}
function resetFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  Object.keys(completeFieldErrors).forEach((key) => delete completeFieldErrors[key]);
}
function validateForm(): { plannedAmount: string; actualAmount: string | null } | false {
  resetFieldErrors();
  const plannedAmount = normalizeMoney(form.plannedAmount);
  const actualAmount = form.status === 'COMPLETED' ? normalizeMoney(form.actualAmount) : null;
  if (!form.sourceAccountId) fieldErrors.sourceAccountId = 'Selecione a conta de origem.';
  if (!form.destinationAccountId)
    fieldErrors.destinationAccountId = 'Selecione a conta de destino.';
  if (form.sourceAccountId === form.destinationAccountId)
    fieldErrors.destinationAccountId = 'Origem e destino devem ser diferentes.';
  if (!form.description.trim()) fieldErrors.description = 'Informe a descricao.';
  if (!plannedAmount)
    fieldErrors.plannedAmount = 'Informe um valor previsto positivo com ate duas casas decimais.';
  if (!form.dueDate) fieldErrors.dueDate = 'Informe o vencimento.';
  if (form.status === 'COMPLETED' && !actualAmount)
    fieldErrors.actualAmount = 'Informe um valor realizado positivo com ate duas casas decimais.';
  if (form.status === 'COMPLETED' && !form.completedAt)
    fieldErrors.completedAt = 'Informe a data de conclusao.';
  if (Object.keys(fieldErrors).length) return false;
  return { plannedAmount: plannedAmount!, actualAmount };
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
  resetFieldErrors();
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
  formSnapshot.value = serializeForm();
  showForm.value = true;
  void nextTick(() => formBackButton.value?.focus());
}
function openEdit(item: PublicFinancialTransfer) {
  resetFieldErrors();
  editing.value = item;
  Object.assign(form, {
    ...item,
    notes: item.notes ?? '',
    actualAmount: item.actualAmount ?? '',
    completedAt: item.completedAt ?? '',
  });
  formSnapshot.value = serializeForm();
  showForm.value = true;
  void nextTick(() => formBackButton.value?.focus());
}
async function save() {
  error.value = '';
  const validation = validateForm();
  if (!validation) {
    await nextTick();
    formDialog.value
      ?.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid, select:invalid')
      ?.focus();
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
    closeForm();
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
  Object.keys(completeFieldErrors).forEach((key) => delete completeFieldErrors[key]);
  const actualAmount = normalizeMoney(completeForm.actualAmount);
  if (!actualAmount) {
    completeFieldErrors.actualAmount =
      'Informe um valor realizado positivo com ate duas casas decimais.';
  }
  if (!completeForm.completedAt) {
    completeFieldErrors.completedAt = 'Informe a data de conclusao.';
  }
  if (Object.keys(completeFieldErrors).length) {
    await nextTick();
    completeDialog.value
      ?.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid')
      ?.focus();
    return;
  }
  try {
    await api(`/transfers/${completing.value.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualAmount, completedAt: completeForm.completedAt }),
    });
    closeComplete();
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
function closeForm(releaseHistory = true) {
  showForm.value = false;
  editing.value = null;
  formSnapshot.value = '';
  resetFieldErrors();
  if (releaseHistory) releaseModalHistory();
}
function closeComplete(releaseHistory = true) {
  completing.value = null;
  completeSnapshot.value = '';
  Object.keys(completeFieldErrors).forEach((key) => delete completeFieldErrors[key]);
  if (releaseHistory) releaseModalHistory();
}
function requestDiscard(
  target: 'form' | 'complete',
  source: 'button' | 'route' | 'history' = 'button',
  returnFocus?: HTMLElement | null,
) {
  const isDirty = target === 'form' ? formDirty.value : completeDirty.value;
  if (!isDirty) {
    if (target === 'form') closeForm(source !== 'history');
    else closeComplete(source !== 'history');
    return;
  }
  discardTarget.value = target;
  discardSource.value = source;
  discardReturnFocus = returnFocus ?? null;
  showDiscardConfirm.value = true;
}
function cancelDiscard() {
  showDiscardConfirm.value = false;
  pendingRoute.value = '';
  if (discardSource.value === 'history') ensureModalHistory();
  discardSource.value = 'button';
  void nextTick(() => (discardReturnFocus ?? formBackButton.value)?.focus());
}
async function confirmDiscard() {
  const target = discardTarget.value;
  const source = discardSource.value;
  const route = pendingRoute.value;
  showDiscardConfirm.value = false;
  pendingRoute.value = '';
  discardSource.value = 'button';
  if (target === 'form') closeForm(source === 'button');
  else closeComplete(source === 'button');
  if (source === 'route' && route) await router.push(route);
}
function startComplete(item: PublicFinancialTransfer) {
  completing.value = item;
  completeForm.actualAmount = item.plannedAmount;
  completeForm.completedAt = item.dueDate;
  completeSnapshot.value = serializeCompleteForm();
  void nextTick(() => completeDialog.value?.querySelector<HTMLElement>('input, button')?.focus());
}
function closeTopDialog(releaseHistory = true) {
  if (showDiscardConfirm.value) {
    cancelDiscard();
    return true;
  }
  if (completing.value) {
    requestDiscard('complete', releaseHistory ? 'button' : 'history');
    return true;
  }
  if (showForm.value) {
    requestDiscard('form', releaseHistory ? 'button' : 'history', formBackButton.value);
    return true;
  }
  if (filtersOpen.value) {
    filtersOpen.value = false;
    void nextTick(() => moreFiltersButton.value?.focus());
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
  () => showForm.value || !!completing.value || showDiscardConfirm.value,
  (active) => {
    setModalScrollLock('transfers', active);
    if (showForm.value || !!completing.value) ensureModalHistory();
    else releaseModalHistory();
  },
);
watch(showDiscardConfirm, async (visible) => {
  if (!visible) return;
  await nextTick();
  discardDialog.value?.querySelector<HTMLElement>('button')?.focus();
});
onBeforeRouteLeave((to) => {
  if (!hasUnsavedChanges.value || showDiscardConfirm.value) return true;
  pendingRoute.value = to.fullPath;
  discardSource.value = 'route';
  discardTarget.value = formDirty.value ? 'form' : 'complete';
  discardReturnFocus = formBackButton.value;
  showDiscardConfirm.value = true;
  return false;
});
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
    <PageHeader title="Transferências" back-to="/mais">
      <template #action><button @click="openCreate">Nova transferência</button></template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load()">Tentar novamente</button>
    </p>
    <section class="filters" aria-label="Filtros">
      <div class="primary-filters">
        <label>Vencimento inicial<input v-model="filters.dueDateFrom" type="date" /></label
        ><label>Vencimento final<input v-model="filters.dueDateTo" type="date" /></label>
        <div class="filter-actions">
          <button type="button" @click="load()">Aplicar</button
          ><button
            ref="moreFiltersButton"
            type="button"
            class="secondary"
            :aria-expanded="filtersOpen"
            aria-controls="transfer-secondary-filters"
            @click="filtersOpen = !filtersOpen"
          >
            Mais filtros<span v-if="activeSecondaryFilters" class="filter-badge">{{
              activeSecondaryFilters
            }}</span></button
          ><button v-if="hasFilters" type="button" class="link" @click="clearFilters">
            Limpar filtros
          </button>
        </div>
      </div>
      <p v-if="hasFilters" class="filter-status" role="status">{{ filterStatusText }}</p>
      <div v-show="filtersOpen" id="transfer-secondary-filters" class="secondary-filters">
        <label
          >Origem<select v-model="filters.sourceAccountId">
            <option value="">Todas as origens</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        >
        <label
          >Destino<select v-model="filters.destinationAccountId">
            <option value="">Todos os destinos</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        >
        <label
          >Conta participante<select v-model="filters.accountId">
            <option value="">Qualquer conta participante</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        >
        <label
          >Estado<select v-model="filters.status">
            <option value="">Todos os estados</option>
            <option value="PENDING">Pendente</option>
            <option value="COMPLETED">Concluída</option>
          </select></label
        >
        <label>Conclusão inicial<input v-model="filters.completedAtFrom" type="date" /></label
        ><label>Conclusão final<input v-model="filters.completedAtTo" type="date" /></label>
      </div>
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
          ><button v-if="item.status === 'PENDING'" @click="startComplete(item)">Concluir</button
          ><button v-else @click="reopen(item)">Reabrir</button>
        </div>
      </article>
      <button v-if="nextCursor" :disabled="loading" @click="load(true)">Carregar mais</button>
    </section>
    <div v-if="showForm" class="modal" role="dialog" aria-modal="true" aria-label="Transferencia">
      <form ref="formDialog" @submit.prevent="save">
        <h2>{{ editing ? 'Editar transferência' : 'Nova transferência' }}</h2>
        <div class="modal-body">
          <h3 class="group-title">Contas</h3>
          <label
            >Origem<select
              v-model="form.sourceAccountId"
              :disabled="editing?.status === 'COMPLETED'"
              :aria-invalid="!!fieldErrors.sourceAccountId"
              aria-describedby="transfer-source-error"
              required
            >
              <option value="">Selecione</option>
              <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
            <span
              v-if="fieldErrors.sourceAccountId"
              id="transfer-source-error"
              class="field-error"
              >{{ fieldErrors.sourceAccountId }}</span
            ></label
          >
          <label
            >Destino<select
              v-model="form.destinationAccountId"
              :disabled="editing?.status === 'COMPLETED'"
              :aria-invalid="!!fieldErrors.destinationAccountId"
              aria-describedby="transfer-destination-error"
              required
            >
              <option value="">Selecione</option>
              <option v-for="a in destinations" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
            <span
              v-if="fieldErrors.destinationAccountId"
              id="transfer-destination-error"
              class="field-error"
              >{{ fieldErrors.destinationAccountId }}</span
            ></label
          >
          <h3 class="group-title">Detalhes</h3>
          <label
            >Descrição<input
              v-model="form.description"
              maxlength="200"
              :aria-invalid="!!fieldErrors.description"
              aria-describedby="transfer-description-error"
              required
            />
            <span
              v-if="fieldErrors.description"
              id="transfer-description-error"
              class="field-error"
              >{{ fieldErrors.description }}</span
            ></label
          ><label>Notas<textarea v-model="form.notes" maxlength="2000" /></label
          ><label
            >Valor previsto<input
              v-model="form.plannedAmount"
              inputmode="decimal"
              :disabled="editing?.status === 'COMPLETED'"
              :aria-invalid="!!fieldErrors.plannedAmount"
              aria-describedby="transfer-planned-error"
              required
            />
            <span
              v-if="fieldErrors.plannedAmount"
              id="transfer-planned-error"
              class="field-error"
              >{{ fieldErrors.plannedAmount }}</span
            ></label
          ><label
            >Vencimento<input
              v-model="form.dueDate"
              type="date"
              :disabled="editing?.status === 'COMPLETED'"
              :aria-invalid="!!fieldErrors.dueDate"
              aria-describedby="transfer-due-date-error"
              required
            />
            <span v-if="fieldErrors.dueDate" id="transfer-due-date-error" class="field-error">{{
              fieldErrors.dueDate
            }}</span></label
          ><template v-if="!editing"
            ><h3 class="group-title">Conclusão</h3>
            <label
              >Estado<select v-model="form.status">
                <option value="PENDING">Pendente</option>
                <option value="COMPLETED">Concluída</option>
              </select></label
            ><template v-if="form.status === 'COMPLETED'"
              ><label
                >Valor realizado<input
                  v-model="form.actualAmount"
                  inputmode="decimal"
                  :aria-invalid="!!fieldErrors.actualAmount"
                  aria-describedby="transfer-actual-error"
                  required
                />
                <span
                  v-if="fieldErrors.actualAmount"
                  id="transfer-actual-error"
                  class="field-error"
                  >{{ fieldErrors.actualAmount }}</span
                ></label
              ><label
                >Data de conclusão<input
                  v-model="form.completedAt"
                  type="date"
                  :aria-invalid="!!fieldErrors.completedAt"
                  aria-describedby="transfer-completed-error"
                  required
                />
                <span
                  v-if="fieldErrors.completedAt"
                  id="transfer-completed-error"
                  class="field-error"
                  >{{ fieldErrors.completedAt }}</span
                ></label
              ></template
            ></template
          >
          <p v-if="editing?.status === 'COMPLETED'">
            Reabra primeiro para alterar contas, valor previsto ou vencimento.
          </p>
        </div>
        <div class="actions">
          <button
            ref="formBackButton"
            type="button"
            class="secondary"
            @click="requestDiscard('form', 'button', formBackButton)"
          >
            Voltar</button
          ><button
            type="button"
            class="secondary"
            @click="requestDiscard('form', 'button', formBackButton)"
          >
            Cancelar</button
          ><button :disabled="loading">
            {{ loading ? 'Salvando...' : 'Salvar transferencia' }}
          </button>
        </div>
      </form>
    </div>
    <div
      v-if="completing"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Concluir transferencia"
    >
      <form ref="completeDialog" @submit.prevent="complete">
        <h2>Concluir transferência</h2>
        <div class="modal-body">
          <label
            >Valor realizado<input
              v-model="completeForm.actualAmount"
              inputmode="decimal"
              :aria-invalid="!!completeFieldErrors.actualAmount"
              aria-describedby="complete-actual-error"
              required
            />
            <span
              v-if="completeFieldErrors.actualAmount"
              id="complete-actual-error"
              class="field-error"
              >{{ completeFieldErrors.actualAmount }}</span
            ></label
          ><label
            >Data de conclusão<input
              v-model="completeForm.completedAt"
              type="date"
              :aria-invalid="!!completeFieldErrors.completedAt"
              aria-describedby="complete-date-error"
              required
            />
            <span
              v-if="completeFieldErrors.completedAt"
              id="complete-date-error"
              class="field-error"
              >{{ completeFieldErrors.completedAt }}</span
            ></label
          >
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="requestDiscard('complete')">
            Cancelar</button
          ><button>Confirmar</button>
        </div>
      </form>
    </div>
    <div
      v-if="showDiscardConfirm"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Descartar alteracoes"
    >
      <section ref="discardDialog" class="discard-dialog">
        <h2>Descartar alteracoes?</h2>
        <p>As alteracoes nao salvas serao perdidas.</p>
        <div class="actions">
          <button type="button" class="secondary" @click="cancelDiscard">Continuar editando</button
          ><button type="button" @click="confirmDiscard">Descartar</button>
        </div>
      </section>
    </div>
  </main>
</template>
<style scoped>
.transfers-page {
  width: min(100%, 76rem);
  padding: 2rem 2rem calc(var(--shell-nav-height, 0px) + 3rem + env(safe-area-inset-bottom));
}
.actions,
.amounts {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
}
.filters {
  display: grid;
  gap: 0.65rem;
  margin: 1.5rem 0;
}
.primary-filters,
.secondary-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}
.filter-actions {
  display: flex;
  gap: 0.5rem;
  align-items: end;
  flex-wrap: wrap;
}
.filter-badge {
  display: inline-grid;
  place-items: center;
  min-width: 1.35rem;
  min-height: 1.35rem;
  margin-left: 0.45rem;
  border-radius: 999px;
  background: var(--color-accent-container);
  color: var(--color-on-accent-container);
  font-size: 0.8rem;
}
.filter-status {
  margin: 0;
  color: var(--color-text-muted);
  font-weight: 700;
}
.list {
  display: grid;
  gap: 1rem;
}
.list article,
.empty,
form,
.discard-dialog {
  background: var(--color-surface);
  padding: 1.25rem;
  border-radius: 8px;
  box-shadow: var(--shadow-surface);
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
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.link {
  background: none;
  color: #b42318;
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
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding-right: 0.25rem;
}
.group-title {
  margin: 0;
  color: var(--color-accent);
  font-size: 0.95rem;
}
.modal-body > label:nth-of-type(1),
.modal-body > label:nth-of-type(2) {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-muted);
}
.field-error {
  display: block;
  margin-top: 0.35rem;
  color: #b42318;
  font-size: 0.9rem;
  font-weight: 700;
}
[aria-invalid='true'] {
  border-color: #b42318;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text);
}
@media (max-width: 600px) {
  .transfers-page {
    padding: 0;
  }
  .amounts,
  .primary-filters,
  .secondary-filters {
    align-items: stretch;
    flex-direction: column;
    grid-template-columns: 1fr;
  }
  .actions,
  .filter-actions {
    flex-wrap: wrap;
  }
  .filter-actions button,
  .empty button {
    flex: 1 1 10rem;
  }
  .modal {
    align-items: end;
    place-items: end stretch;
    padding: max(0.75rem, env(safe-area-inset-top)) 0 0;
  }
  .modal form,
  .discard-dialog {
    width: 100%;
    max-height: calc(100dvh - max(0.75rem, env(safe-area-inset-top)));
    border-radius: 1rem 1rem 0 0;
  }
  .modal form .actions {
    padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
  }
}
</style>
