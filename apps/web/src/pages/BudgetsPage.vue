<script setup lang="ts">
/* eslint-disable no-undef */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import type { PublicFinancialCategory, PublicMonthlyBudget } from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import CategoryIcon from '../components/CategoryIcon.vue';
import KebabMenu, { type KebabMenuAction } from '../components/KebabMenu.vue';
import { normalizeMoney } from '../transaction-template';

type BudgetFormLine = { categoryId: string; limitAmount: string };
type ApiErrorDetail = { field?: string; message?: string };
type LeaveIntent = 'edit' | 'history' | 'route';

const router = useRouter();

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
const pageError = ref('');
const formError = ref('');
const editing = ref(false);
const dirty = ref(false);
const discardOpen = ref(false);
const leaveIntent = ref<LeaveIntent>('edit');
const pendingRoute = ref('');
const discardDialog = ref<HTMLElement | null>(null);
const copyOpen = ref(false);
const copyMonth = ref('');
const form = reactive({
  totalLimit: '',
  notes: '',
  categories: [] as BudgetFormLine[],
});
const fieldErrors = reactive<Record<string, string>>({});

const categoryMap = computed(() => new Map(categories.value.map((item) => [item.id, item])));
const available = computed(() =>
  categories.value.filter(
    (category) =>
      category.type === 'EXPENSE' &&
      !category.archivedAt &&
      !form.categories.some((line) => line.categoryId === category.id),
  ),
);
const budgetActions = computed<KebabMenuAction[]>(() => [
  { label: 'Copiar orçamento', onSelect: () => (copyOpen.value = true) },
]);
const committedExceeded = computed(() =>
  Boolean(budget.value?.totals.remainingAgainstCommitted.startsWith('-')),
);

const money = (value: string) => {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}R$ ${match[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[3]}`;
};
const percentLabel = (value: string) => `${value}%`;
const ariaPercentValue = (value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
};
const accessiblePercentLabel = (value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return percentLabel(value);
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numeric)}%`;
};
const committedAriaText = (value: string, exceeded: boolean, context?: string) =>
  `${context ? `${context}: ` : ''}${accessiblePercentLabel(value)} comprometido${
    exceeded ? ' - limite excedido' : ''
  }`;
const progressStyle = (value: string) => ({
  '--progress': `${Math.min(Math.max(Number(value), 0), 100)}%`,
});
type BudgetCategoryField = 'categoryId' | 'limitAmount';
const categoryFieldKey = (categoryId: string, field: BudgetCategoryField) =>
  `category:${categoryId}:${field}`;
const categoryMeta = (id: string) => categoryMap.value.get(id);
const categoryName = (id: string) =>
  budget.value?.categories.find((item) => item.categoryId === id)?.categoryName ??
  categoryMeta(id)?.name ??
  id;
const isArchived = (id: string) =>
  Boolean(budget.value?.categories.find((item) => item.categoryId === id)?.categoryArchived);
const isZeroInput = (value: string) => normalizeMoney(value, { allowZero: true }) === '0.00';

class ApiRequestError extends Error {
  status?: number;
  code?: string;
  details: ApiErrorDetail[];
  constructor(message: string, status?: number, code?: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
}
function setFieldError(key: string, message: string) {
  fieldErrors[key] = message;
}
function applyApiDetails(details: ApiErrorDetail[]) {
  details.forEach((detail) => {
    if (detail.field === 'totalLimit') setFieldError('totalLimit', 'Informe um valor válido.');
    else if (detail.field === 'categories')
      form.categories.forEach((line) =>
        setFieldError(
          categoryFieldKey(line.categoryId, 'limitAmount'),
          'Revise o limite desta categoria.',
        ),
      );
    else {
      const match = /^categories\.(\d+)\.(categoryId|limitAmount)$/.exec(detail.field ?? '');
      if (!match) return;
      const line = form.categories[Number(match[1])];
      const field = match[2] as BudgetCategoryField;
      if (!line) return;
      setFieldError(
        categoryFieldKey(line.categoryId, field),
        field === 'limitAmount' ? 'Revise o limite desta categoria.' : 'Revise esta categoria.',
      );
    }
  });
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new ApiRequestError('API indisponível. Tente novamente.');
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
  };
  if (!response.ok)
    throw new ApiRequestError(
      data.error?.message ?? 'Não foi possível continuar.',
      response.status,
      data.error?.code,
      Array.isArray(data.error?.details) ? data.error.details : [],
    );
  return data as T;
}
async function load() {
  loading.value = true;
  pageError.value = '';
  absent.value = false;
  copyOpen.value = false;
  try {
    budget.value = await request(`/budgets?month=${encodeURIComponent(month.value)}`);
  } catch (failure) {
    if (failure instanceof ApiRequestError && failure.status === 404) {
      budget.value = null;
      absent.value = true;
    } else pageError.value = failure instanceof Error ? failure.message : 'Falha ao carregar.';
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
  clearFieldErrors();
  formError.value = '';
  copyOpen.value = false;
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
  dirty.value = false;
  discardOpen.value = false;
  pendingRoute.value = '';
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
  dirty.value = false;
  discardOpen.value = false;
  pendingRoute.value = '';
  formError.value = '';
  clearFieldErrors();
}
function requestLeave(intent: LeaveIntent = 'edit') {
  if (!dirty.value) {
    if (intent === 'edit') cancelEdit();
    else if (intent === 'history') router.back();
    return;
  }
  leaveIntent.value = intent;
  discardOpen.value = true;
}
function cancelDiscard() {
  discardOpen.value = false;
  pendingRoute.value = '';
}
async function confirmDiscard() {
  const intent = leaveIntent.value;
  const route = pendingRoute.value;
  cancelEdit();
  if (intent === 'history') router.back();
  else if (intent === 'route' && route) await router.push(route);
}
function onAndroidBack(event: Event) {
  if (discardOpen.value) {
    cancelDiscard();
    event.preventDefault();
    return;
  }
  if (!editing.value || !dirty.value) return;
  requestLeave('history');
  event.preventDefault();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !discardOpen.value) return;
  cancelDiscard();
  event.preventDefault();
}
function addCategory(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (id && !form.categories.some((line) => line.categoryId === id)) {
    form.categories.push({ categoryId: id, limitAmount: '' });
    dirty.value = true;
  }
  (event.target as HTMLSelectElement).value = '';
}
function removeCategory(index: number) {
  form.categories.splice(index, 1);
  dirty.value = true;
}
function validateForm() {
  clearFieldErrors();
  formError.value = '';
  const totalLimit = normalizeMoney(form.totalLimit);
  if (!totalLimit) {
    setFieldError(
      'totalLimit',
      isZeroInput(form.totalLimit) ? 'O limite deve ser maior que zero.' : 'Informe um valor válido.',
    );
  }
  const categoriesPayload = form.categories.map((line) => {
    const limitAmount = normalizeMoney(line.limitAmount);
    if (!limitAmount)
      setFieldError(
        categoryFieldKey(line.categoryId, 'limitAmount'),
        isZeroInput(line.limitAmount)
          ? 'O limite deve ser maior que zero.'
          : 'Revise o limite desta categoria.',
      );
    return limitAmount ? { categoryId: line.categoryId, limitAmount } : null;
  });
  if (!totalLimit || categoriesPayload.some((item) => !item)) {
    formError.value = 'Revise os campos destacados.';
    return null;
  }
  return {
    totalLimit,
    notes: form.notes || null,
    categories: categoriesPayload as Array<{ categoryId: string; limitAmount: string }>,
  };
}
async function save() {
  const payload = validateForm();
  if (!payload) return;
  saving.value = true;
  formError.value = '';
  try {
    const body = { ...payload, ...(!budget.value ? { month: month.value } : {}) };
    budget.value = await request(budget.value ? `/budgets/${budget.value.id}` : '/budgets', {
      method: budget.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    absent.value = false;
    editing.value = false;
    dirty.value = false;
    clearFieldErrors();
  } catch (failure) {
    if (failure instanceof ApiRequestError) applyApiDetails(failure.details);
    formError.value = failure instanceof Error ? failure.message : 'Falha ao salvar.';
  } finally {
    saving.value = false;
  }
}
async function copy() {
  if (!budget.value) return;
  saving.value = true;
  formError.value = '';
  pageError.value = '';
  try {
    const copied = await request<PublicMonthlyBudget>(`/budgets/${budget.value.id}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth: copyMonth.value }),
    });
    month.value = copied.month;
    budget.value = copied;
    copyOpen.value = false;
    copyMonth.value = '';
  } catch (failure) {
    pageError.value =
      failure instanceof ApiRequestError && failure.status === 409
        ? 'Já existe um orçamento no mês de destino.'
        : failure instanceof Error
          ? failure.message
          : 'Falha ao copiar.';
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  try {
    categories.value = await request('/categories?type=EXPENSE&includeArchived=true');
  } catch {
    categories.value = [];
  }
  await load();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
});
onBeforeRouteLeave((to) => {
  if (!editing.value || !dirty.value) return true;
  pendingRoute.value = to.fullPath;
  requestLeave('route');
  return false;
});
watch(discardOpen, async (visible) => {
  if (!visible) return;
  await nextTick();
  discardDialog.value?.querySelector<HTMLElement>('button')?.focus();
});
</script>

<template>
  <main class="budgets" :class="{ 'budgets--editing': editing }">
    <header class="page-head"><h1>Orçamento mensal</h1></header>
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

    <p v-if="loading" role="status" class="state">Carregando...</p>
    <div v-if="pageError && !editing" role="alert" class="alert">
      <span>{{ pageError }}</span>
      <button type="button" class="secondary" @click="load">Tentar novamente</button>
    </div>

    <section v-if="absent && !editing && !loading" class="empty-state">
      <h2>Nenhum orçamento neste mês</h2>
      <p>Defina um limite total e, se quiser, acompanhe categorias específicas.</p>
      <button type="button" @click="startEdit">Criar orçamento</button>
    </section>

    <form
      v-if="editing"
      class="budget-form"
      novalidate
      @submit.prevent="save"
      @input="dirty = true"
    >
      <div class="form-head">
        <div>
          <h2>{{ budget ? 'Editar orçamento' : 'Criar orçamento' }}</h2>
          <p>{{ month }}</p>
        </div>
      </div>
      <p v-if="formError" role="alert" class="alert compact">{{ formError }}</p>
      <label>
        Limite total
        <input
          v-model="form.totalLimit"
          required
          inputmode="decimal"
          placeholder="5.000,00"
          :aria-invalid="Boolean(fieldErrors.totalLimit)"
          aria-describedby="budget-total-error"
        />
        <small id="budget-total-error">{{ fieldErrors.totalLimit }}</small>
      </label>
      <label>Notas <textarea v-model="form.notes" maxlength="2000" /></label>
      <label>
        Adicionar categoria
        <select @change="addCategory">
          <option value="">Selecione</option>
          <option v-for="item in available" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <fieldset>
        <legend>Limites por categoria</legend>
        <p v-if="!form.categories.length" class="muted">Nenhuma categoria específica adicionada.</p>
        <div v-for="(line, index) in form.categories" :key="line.categoryId" class="category-edit">
          <CategoryIcon
            :icon="categoryMeta(line.categoryId)?.icon"
            :color="categoryMeta(line.categoryId)?.color"
            :label="categoryName(line.categoryId)"
          />
          <span>
            {{ categoryName(line.categoryId) }}
            <em v-if="isArchived(line.categoryId)">(arquivada)</em>
            <small v-if="fieldErrors[categoryFieldKey(line.categoryId, 'categoryId')]">
              {{ fieldErrors[categoryFieldKey(line.categoryId, 'categoryId')] }}
            </small>
          </span>
          <label>
            <span class="visually-hidden">Limite da categoria</span>
            <input
              v-model="line.limitAmount"
              required
              inputmode="decimal"
              placeholder="500,00"
              :disabled="isArchived(line.categoryId)"
              :aria-invalid="Boolean(fieldErrors[categoryFieldKey(line.categoryId, 'limitAmount')])"
            />
            <small>{{ fieldErrors[categoryFieldKey(line.categoryId, 'limitAmount')] }}</small>
          </label>
          <button
            type="button"
            class="icon-button"
            :aria-label="`Remover ${categoryName(line.categoryId)}`"
            @click="removeCategory(index)"
          >
            <span class="material-icons" aria-hidden="true">delete</span>
          </button>
        </div>
      </fieldset>
      <div class="form-actions">
        <button type="button" class="secondary" :disabled="saving" @click="requestLeave()">
          Voltar
        </button>
        <button :disabled="saving">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
      </div>
    </form>

    <div v-if="discardOpen" class="discard-backdrop" @click.self="cancelDiscard">
      <section
        ref="discardDialog"
        class="discard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-discard-title"
      >
        <h2 id="budget-discard-title">Descartar alterações?</h2>
        <p>As alterações não salvas serão perdidas.</p>
        <div>
          <button type="button" class="secondary" @click="cancelDiscard">Continuar editando</button>
          <button type="button" @click="confirmDiscard">Descartar</button>
        </div>
      </section>
    </div>

    <section v-if="budget && !editing" class="budget-view">
      <section class="summary-panel" :class="{ exceeded: committedExceeded }">
        <div class="summary-top">
          <div>
            <h2>Resumo</h2>
            <p v-if="committedExceeded" class="status-label">
              <span class="material-icons" aria-hidden="true">warning</span>
              Limite comprometido excedido
            </p>
          </div>
          <div class="summary-actions">
            <button type="button" class="edit-action" @click="startEdit">
              <span class="material-icons" aria-hidden="true">edit</span>
              Editar orçamento
            </button>
            <KebabMenu label="Mais ações do orçamento" :actions="budgetActions" />
          </div>
        </div>
        <dl class="summary-grid">
          <div>
            <dt>Limite</dt>
            <dd>{{ money(budget.totalLimit) }}</dd>
          </div>
          <div>
            <dt>Comprometido</dt>
            <dd>{{ money(budget.totals.committedExpense) }}</dd>
          </div>
          <div>
            <dt>Restante</dt>
            <dd>{{ money(budget.totals.remainingAgainstCommitted) }}</dd>
          </div>
          <div>
            <dt>Realizado</dt>
            <dd>{{ money(budget.totals.realizedExpense) }}</dd>
          </div>
        </dl>
        <div
          class="progress"
          :class="{ over: committedExceeded }"
          :style="progressStyle(budget.totals.committedPercent)"
          role="meter"
          aria-label="Percentual comprometido do orçamento"
          :aria-valuenow="ariaPercentValue(budget.totals.committedPercent)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuetext="
            committedAriaText(budget.totals.committedPercent, committedExceeded)
          "
        />
        <p class="summary-meta">
          Comprometido {{ percentLabel(budget.totals.committedPercent) }} · Realizado
          {{ percentLabel(budget.totals.realizedPercent) }}
        </p>
      </section>

      <form v-if="copyOpen" class="copy-panel" @submit.prevent="copy">
        <label>Copiar para <input v-model="copyMonth" type="month" required /></label>
        <button :disabled="saving">{{ saving ? 'Copiando...' : 'Copiar orçamento' }}</button>
        <button type="button" class="secondary" :disabled="saving" @click="copyOpen = false">
          Cancelar
        </button>
      </form>

      <section class="section-block">
        <h2>Categorias</h2>
        <p v-if="!budget.categories.length" class="muted">Nenhuma categoria com limite específico.</p>
        <article
          v-for="line in budget.categories"
          :key="line.categoryId"
          class="category-row"
          :class="{ exceeded: line.remainingAgainstCommitted.startsWith('-') }"
        >
          <CategoryIcon
            :icon="categoryMeta(line.categoryId)?.icon"
            :color="categoryMeta(line.categoryId)?.color"
            :label="line.categoryName"
          />
          <div class="category-content">
            <div class="category-main">
              <h3>
                {{ line.categoryName }}
                <small v-if="line.categoryArchived">Arquivada</small>
              </h3>
              <strong>{{ money(line.committedExpense) }} / {{ money(line.limitAmount) }}</strong>
            </div>
            <div
              class="progress"
              :class="{ over: line.remainingAgainstCommitted.startsWith('-') }"
              :style="progressStyle(line.committedPercent)"
              role="meter"
              :aria-label="`Percentual comprometido de ${line.categoryName}`"
              :aria-valuenow="ariaPercentValue(line.committedPercent)"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuetext="
                committedAriaText(
                  line.committedPercent,
                  line.remainingAgainstCommitted.startsWith('-'),
                  line.categoryName,
                )
              "
            />
            <p>
              <span>Comprometido {{ percentLabel(line.committedPercent) }}</span>
              <span>Realizado {{ money(line.realizedExpense) }}</span>
              <span v-if="line.remainingAgainstCommitted.startsWith('-')" class="status-label">
                Excedida
              </span>
            </p>
          </div>
        </article>
      </section>

      <section class="section-block other-expenses">
        <h2>Outras despesas</h2>
        <div>
          <h3>Sem limite específico</h3>
          <dl>
            <div>
              <dt>Realizado</dt>
              <dd>{{ money(budget.totals.unbudgetedRealizedExpense) }}</dd>
            </div>
            <div>
              <dt>Comprometido</dt>
              <dd>{{ money(budget.totals.unbudgetedCommittedExpense) }}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3>Custos de dívida não categorizados</h3>
          <dl>
            <div>
              <dt>Realizado</dt>
              <dd>{{ money(budget.totals.uncategorizedDebtCostRealized) }}</dd>
            </div>
            <div>
              <dt>Comprometido</dt>
              <dd>{{ money(budget.totals.uncategorizedDebtCostCommitted) }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.budgets {
  width: min(100%, 70rem);
  padding: 1rem 1rem calc(var(--shell-nav-height, 0px) + 5rem + env(safe-area-inset-bottom));
}
.page-head h1 {
  margin-bottom: 0.5rem;
}
.month-nav {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem auto;
  gap: 0.5rem;
  align-items: center;
}
.month-nav strong {
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  padding: 0 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.65rem;
}
.month-nav button,
.edit-action,
.summary-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}
.month-nav button,
.edit-action {
  min-height: 2.75rem;
}
.current-month,
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.state,
.empty-state,
.budget-form,
.summary-panel,
.copy-panel,
.section-block {
  margin-top: 0.85rem;
}
.empty-state,
.budget-form,
.summary-panel,
.copy-panel,
.section-block {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1rem;
}
.budget-form {
  display: grid;
  gap: 0.75rem;
}
.budget-form h2,
.budget-form p,
.budget-form fieldset {
  margin-block: 0;
}
.empty-state p,
.muted,
.summary-meta,
.category-row p,
.form-head p {
  color: var(--color-text-muted);
}
.alert {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid var(--color-error-border);
  border-radius: 0.65rem;
  color: var(--color-error);
  background: var(--color-error-container);
}
.alert.compact {
  display: block;
  margin: 0;
}
.form-head,
.summary-top,
.category-main {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}
.summary-actions {
  flex-wrap: wrap;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0.75rem 0;
}
.summary-grid div,
.other-expenses dl div {
  min-width: 0;
}
dt {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}
dd {
  margin: 0;
  font-weight: 750;
  overflow-wrap: anywhere;
}
.progress {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}
.progress::before {
  content: '';
  display: block;
  width: var(--progress);
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
}
.progress.over::before {
  background: var(--color-error);
}
.status-label {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--color-error);
  font-weight: 700;
}
.status-label .material-icons {
  font-size: 1rem;
}
fieldset {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.65rem;
}
.category-edit,
.category-row {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
}
.category-edit label {
  min-width: 10rem;
}
.category-edit small,
label > small {
  min-height: 1.1rem;
  color: var(--color-error);
}
.icon-button {
  width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 50%;
}
.icon-button:hover {
  background: var(--color-surface-muted);
  color: var(--color-error);
}
.form-actions,
.copy-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}
.form-actions {
  padding-top: 0.25rem;
  padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
  background: var(--color-surface);
}
.form-actions button {
  flex: 1 1 10rem;
}
.copy-panel {
  justify-content: flex-end;
}
.copy-panel label {
  flex: 1 1 12rem;
}
.discard-backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--color-overlay);
}
.discard-dialog {
  width: min(100%, 28rem);
  padding: 1rem;
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
}
.discard-dialog h2 {
  margin-top: 0;
}
.discard-dialog div {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.section-block {
  display: grid;
  gap: 0.65rem;
}
.category-row {
  grid-template-columns: 1.75rem minmax(0, 1fr);
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border);
}
.category-row:first-of-type {
  border-top: 0;
}
.category-row.exceeded {
  border-left: 0.3rem solid var(--color-error);
  padding-left: 0.6rem;
}
.category-content {
  min-width: 0;
  display: grid;
  gap: 0.4rem;
}
.category-main h3,
.category-row p,
.other-expenses h3 {
  margin: 0;
}
.category-main h3 {
  min-width: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.category-main small {
  color: var(--color-text-muted);
  font-weight: 600;
}
.category-main strong {
  white-space: nowrap;
}
.category-row p {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  font-size: 0.85rem;
}
.other-expenses {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.other-expenses h2 {
  grid-column: 1 / -1;
}
.other-expenses > div {
  min-width: 0;
}
.other-expenses h3 {
  font-size: 1rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.other-expenses dl {
  display: grid;
  gap: 0.35rem;
}
.other-expenses dl div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
textarea,
select {
  font: inherit;
  padding: 0.75rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
[aria-invalid='true'] {
  border-color: var(--color-error);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
:global(.authenticated-shell:has(.budgets) .global-fab) {
  display: none;
}
:global(.authenticated-shell:has(.budgets--editing) .bottom-nav) {
  display: none;
}
@media (max-width: 767px) {
  .budgets {
    padding: 0;
  }
  .month-nav {
    grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
  }
  .month-nav .current-month {
    grid-column: 1 / -1;
  }
  .summary-top,
  .form-head,
  .category-main {
    align-items: stretch;
    flex-direction: column;
  }
  .summary-actions {
    justify-content: space-between;
  }
  .summary-grid,
  .other-expenses {
    grid-template-columns: 1fr 1fr;
  }
  .empty-state,
  .budget-form,
  .summary-panel,
  .copy-panel,
  .section-block {
    padding: 0.75rem;
  }
  .state,
  .empty-state,
  .budget-form,
  .summary-panel,
  .copy-panel,
  .section-block {
    margin-top: 0.65rem;
  }
  .section-block {
    gap: 0.5rem;
  }
  fieldset {
    padding: 0.65rem;
  }
  .category-edit {
    grid-template-columns: 1.75rem minmax(0, 1fr) 2.75rem;
  }
  .category-edit label {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .category-edit .icon-button {
    grid-column: 3;
    grid-row: 1;
  }
  .category-row {
    padding: 0.55rem 0;
  }
  .category-main strong {
    white-space: normal;
  }
  .discard-backdrop {
    align-items: end;
    padding: 0;
  }
  .discard-dialog {
    width: 100%;
    padding: 1rem max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
      max(1rem, env(safe-area-inset-left));
    border-radius: 1rem 1rem 0 0;
  }
  :global(.authenticated-shell:has(.budgets) .shell-content) {
    padding-bottom: calc(var(--shell-nav-height) + 1rem + env(safe-area-inset-bottom));
  }
  :global(.authenticated-shell:has(.budgets--editing) .shell-content) {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}
@media (max-width: 390px) {
  .other-expenses {
    grid-template-columns: 1fr;
  }
}
</style>
