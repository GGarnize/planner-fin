<script setup lang="ts">
/* global Event, HTMLButtonElement, HTMLElement, KeyboardEvent, window */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type {
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicRecurrence,
  PublicTransactionTemplate,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { filterActiveTemplates, normalizeMoney } from '../transaction-template';
const items = ref<PublicRecurrence[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]),
  loading = ref(true),
  saving = ref(false),
  error = ref(''),
  editing = ref<PublicRecurrence | null>(null);
const templates = ref<PublicTransactionTemplate[]>([]),
  templateError = ref(''),
  templateWarning = ref(''),
  selectedTemplate = ref<PublicTransactionTemplate | null>(null),
  pendingTemplate = ref<PublicTransactionTemplate | null>(null),
  templateSearch = ref(''),
  showTemplates = ref(false),
  showConfirm = ref(false),
  dirty = ref(false),
  calendarDirty = ref(false);
const templateTrigger = ref<HTMLButtonElement | null>(null),
  templateDialog = ref<HTMLElement | null>(null),
  confirmDialog = ref<HTMLElement | null>(null);
let templateHistoryPushed = false,
  handlingDialogPop = false;
const form = reactive({
  kind: 'TRANSACTION',
  transactionType: 'EXPENSE',
  frequency: 'MONTHLY',
  dayOfWeek: 1,
  dayOfMonth: 1,
  monthOfYear: 1,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  accountId: '',
  categoryId: '',
  sourceAccountId: '',
  destinationAccountId: '',
  plannedAmount: '',
  description: '',
  notes: '',
});
const activeAccounts = computed(() => accounts.value.filter((x) => !x.archivedAt));
const activeCategories = computed(() =>
  categories.value.filter((x) => !x.archivedAt && x.type === form.transactionType),
);
const activeTemplates = computed(() => filterActiveTemplates(templates.value, ''));
const filteredTemplates = computed(() =>
  filterActiveTemplates(templates.value, templateSearch.value),
);
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]) {
  let response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(safeApiErrorMessage(body, 'Não foi possível concluir.'));
  return body as T;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    [items.value, accounts.value, categories.value] = await Promise.all([
      api<PublicRecurrence[]>('/recurrences?includeArchived=true'),
      api<PublicFinancialAccount[]>('/accounts?includeArchived=true'),
      api<PublicFinancialCategory[]>('/categories?includeArchived=true'),
    ]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
async function loadTemplates() {
  templateError.value = '';
  try {
    templates.value = await api<PublicTransactionTemplate[]>('/transaction-templates');
  } catch {
    templates.value = [];
    templateError.value =
      'Não foi possível carregar os modelos. Você ainda pode preencher a recorrência manualmente.';
  }
}
function payload() {
  const plannedAmount = normalizeMoney(form.plannedAmount);
  const base = {
    frequency: form.frequency,
    startDate: form.startDate,
    endDate: form.endDate || null,
    plannedAmount,
    description: form.description.trim(),
    notes: form.notes || null,
  };
  const calendar =
    form.frequency === 'WEEKLY'
      ? { dayOfWeek: Number(form.dayOfWeek) }
      : form.frequency === 'MONTHLY'
        ? { dayOfMonth: Number(form.dayOfMonth) }
        : { dayOfMonth: Number(form.dayOfMonth), monthOfYear: Number(form.monthOfYear) };
  const template =
    form.kind === 'TRANSACTION'
      ? {
          transactionType: form.transactionType,
          accountId: form.accountId,
          categoryId: form.categoryId,
        }
      : { sourceAccountId: form.sourceAccountId, destinationAccountId: form.destinationAccountId };
  return { ...base, ...calendar, ...template, ...(editing.value ? {} : { kind: form.kind }) };
}
async function save() {
  if (!normalizeMoney(form.plannedAmount)) {
    error.value = 'Informe um valor planejado válido.';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await api(`/recurrences${editing.value ? `/${editing.value.id}` : ''}`, {
      method: editing.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    });
    editing.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao salvar.';
  } finally {
    saving.value = false;
  }
}
function edit(item: PublicRecurrence) {
  editing.value = item;
  Object.assign(form, item, { endDate: item.endDate ?? '', notes: item.notes ?? '' });
  selectedTemplate.value = null;
  templateWarning.value = '';
  dirty.value = false;
  calendarDirty.value = true;
}
async function openTemplates() {
  templateSearch.value = '';
  pushTemplateHistory();
  showTemplates.value = true;
  await nextTick();
  templateDialog.value?.querySelector<HTMLElement>('input, button')?.focus();
}
function closeTemplates(syncHistoryOrEvent: boolean | Event = true) {
  const syncHistory = typeof syncHistoryOrEvent === 'boolean' ? syncHistoryOrEvent : true;
  showTemplates.value = false;
  if (syncHistory) releaseTemplateHistory();
  else templateHistoryPushed = false;
  void nextTick(() => templateTrigger.value?.focus());
}
function pushTemplateHistory() {
  if (templateHistoryPushed) return;
  window.history.pushState({ plannerfinDialog: 'recurrence-template' }, '', window.location.href);
  templateHistoryPushed = true;
}
function releaseTemplateHistory() {
  if (!templateHistoryPushed || handlingDialogPop) {
    templateHistoryPushed = false;
    return;
  }
  templateHistoryPushed = false;
  window.history.back();
}
function applyTemplate(template: PublicTransactionTemplate) {
  form.transactionType = template.type;
  form.categoryId = template.categoryAvailable ? template.categoryId : '';
  form.accountId = template.defaultAccountAvailable ? (template.defaultAccountId ?? '') : '';
  form.description = template.description;
  form.plannedAmount = template.plannedAmount;
  form.notes = template.notes ?? '';
  if (template.dueDay && !calendarDirty.value) {
    form.frequency = 'MONTHLY';
    form.dayOfMonth = template.dueDay;
  }
  selectedTemplate.value = template;
  templateWarning.value = '';
  if (!template.categoryAvailable)
    templateWarning.value +=
      'A categoria padrão está indisponível. Escolha uma categoria ativa compatível. ';
  if (template.defaultAccountId && !template.defaultAccountAvailable)
    templateWarning.value += 'A conta padrão está indisponível. Escolha uma conta ativa.';
  dirty.value = false;
  showConfirm.value = false;
  pendingTemplate.value = null;
  closeTemplates();
}
function chooseTemplate(template: PublicTransactionTemplate) {
  if (dirty.value) {
    pendingTemplate.value = template;
    showConfirm.value = true;
  } else applyTemplate(template);
}
function cancelTemplate() {
  pendingTemplate.value = null;
  showConfirm.value = false;
  void nextTick(() => templateDialog.value?.querySelector<HTMLElement>('input, button')?.focus());
}
function confirmTemplate() {
  if (pendingTemplate.value) applyTemplate(pendingTemplate.value);
}
function closeTopDialog(syncHistory = true) {
  if (showConfirm.value) cancelTemplate();
  else if (showTemplates.value) closeTemplates(syncHistory);
  else return false;
  return true;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && closeTopDialog()) event.preventDefault();
}
function onAndroidBack(event: Event) {
  if (!closeTopDialog(false)) return;
  event.preventDefault();
}
function onPopState() {
  if (!showConfirm.value && !showTemplates.value) return;
  handlingDialogPop = true;
  if (showConfirm.value) {
    cancelTemplate();
    templateHistoryPushed = false;
    if (showTemplates.value) pushTemplateHistory();
  } else if (showTemplates.value) closeTemplates(false);
  handlingDialogPop = false;
}
function removeTemplate() {
  selectedTemplate.value = null;
}
function markCalendarDirty() {
  calendarDirty.value = true;
}
async function action(item: PublicRecurrence, name: 'pause' | 'resume' | 'archive' | 'generate') {
  if (name === 'archive' && !globalThis.confirm('Arquivar esta recorrência?')) return;
  try {
    await api(`/recurrences/${item.id}/${name}`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha na operação.';
  }
}
function money(value: string) {
  const [integer = '0', cents = '00'] = value.split('.');
  return `R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents.padEnd(2, '0')}`;
}
watch(
  () => form.transactionType,
  () => {
    if (!activeCategories.value.some((category) => category.id === form.categoryId))
      form.categoryId = '';
  },
);
watch(showConfirm, async (visible) => {
  if (!visible) return;
  await nextTick();
  confirmDialog.value?.querySelector<HTMLElement>('button')?.focus();
});
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  window.addEventListener('popstate', onPopState);
  void load();
  void loadTemplates();
});
onBeforeUnmount(() => {
  if (showTemplates.value) releaseTemplateHistory();
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
  window.removeEventListener('popstate', onPopState);
});
</script>
<template>
  <main class="recurrences">
    <header>
      <div>
        <p class="eyebrow">Planejamento</p>
        <h1>Recorrências financeiras</h1>
        <p>
          Programe receitas, despesas e transferências. As ocorrências serão sempre criadas como
          pendentes.
        </p>
      </div>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load">Tentar novamente</button>
    </p>
    <section class="panel">
      <h2>{{ editing ? 'Editar recorrência' : 'Nova recorrência' }}</h2>
      <form @submit.prevent="save" @input="dirty = true">
        <div v-if="form.kind === 'TRANSACTION'" class="template-action">
          <button ref="templateTrigger" type="button" class="secondary" @click="openTemplates">
            Usar modelo...</button
          ><span v-if="selectedTemplate"
            >Modelo: {{ selectedTemplate.name }}
            <button type="button" class="link" @click="removeTemplate">Remover</button></span
          >
        </div>
        <p v-if="form.kind === 'TRANSACTION' && templateError" class="warning" role="alert">
          {{ templateError }}
        </p>
        <p v-if="templateWarning" class="warning" role="alert">{{ templateWarning }}</p>
        <div class="grid">
          <label
            >Tipo<select v-model="form.kind" :disabled="!!editing">
              <option value="TRANSACTION">Lançamento</option>
              <option value="TRANSFER">Transferência</option>
            </select></label
          ><label
            >Frequência<select v-model="form.frequency" @change="markCalendarDirty">
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="YEARLY">Anual</option>
            </select></label
          ><label
            >Início<input
              v-model="form.startDate"
              type="date"
              required
              @change="markCalendarDirty" /></label
          ><label
            >Fim (opcional)<input
              v-model="form.endDate"
              type="date"
              @change="markCalendarDirty" /></label
          ><label v-if="form.frequency === 'WEEKLY'"
            >Dia da semana<select v-model.number="form.dayOfWeek" @change="markCalendarDirty">
              <option v-for="n in 7" :key="n" :value="n">{{ n }}</option>
            </select></label
          ><label v-else
            >Dia do mês<input
              v-model.number="form.dayOfMonth"
              type="number"
              min="1"
              max="31"
              required
              @change="markCalendarDirty" /></label
          ><label v-if="form.frequency === 'YEARLY'"
            >Mês<input
              v-model.number="form.monthOfYear"
              type="number"
              min="1"
              max="12"
              required
              @change="markCalendarDirty" /></label
          ><template v-if="form.kind === 'TRANSACTION'"
            ><label
              >Natureza<select v-model="form.transactionType">
                <option value="INCOME">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </select></label
            ><label
              >Conta<select v-model="form.accountId" required>
                <option value="">Selecione</option>
                <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select></label
            ><label
              >Categoria<select v-model="form.categoryId" required>
                <option value="">Selecione</option>
                <option v-for="c in activeCategories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select></label
            ></template
          ><template v-else
            ><label
              >Origem<select v-model="form.sourceAccountId" required>
                <option value="">Selecione</option>
                <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select></label
            ><label
              >Destino<select v-model="form.destinationAccountId" required>
                <option value="">Selecione</option>
                <option
                  v-for="a in activeAccounts.filter((x) => x.id !== form.sourceAccountId)"
                  :key="a.id"
                  :value="a.id"
                >
                  {{ a.name }}
                </option>
              </select></label
            ></template
          ><label
            >Valor planejado<input
              v-model="form.plannedAmount"
              inputmode="decimal"
              placeholder="0.00"
              required /></label
          ><label>Descrição<input v-model="form.description" maxlength="200" required /></label
          ><label class="wide">Notas<textarea v-model="form.notes" maxlength="2000" /></label>
        </div>
        <div class="actions">
          <button :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar recorrência' }}</button
          ><button v-if="editing" type="button" class="secondary" @click="editing = null">
            Cancelar
          </button>
        </div>
      </form>
    </section>
    <section>
      <h2>Suas recorrências</h2>
      <p v-if="loading">Carregando recorrências…</p>
      <div v-else-if="!items.length" class="empty">
        Nenhuma recorrência cadastrada. Crie a primeira acima.
      </div>
      <div v-else class="cards">
        <article v-for="item in items" :key="item.id" :class="{ archived: item.archivedAt }">
          <div>
            <span class="badge">{{
              item.kind === 'TRANSACTION' ? 'Lançamento' : 'Transferência'
            }}</span>
            <h3>{{ item.description }}</h3>
            <strong>{{ money(item.plannedAmount) }}</strong>
            <p>Próxima ocorrência: {{ item.nextOccurrenceDate ?? 'Encerrada' }}</p>
            <p v-if="item.attentionStatus === 'BLOCKED'" class="warning">
              Atenção: recurso relacionado arquivado.
            </p>
          </div>
          <div class="actions">
            <button v-if="!item.archivedAt" class="secondary" @click="edit(item)">Editar</button
            ><button
              v-if="item.status === 'ACTIVE' && !item.archivedAt"
              class="secondary"
              @click="action(item, 'pause')"
            >
              Pausar</button
            ><button
              v-if="item.status === 'PAUSED' && !item.archivedAt"
              @click="action(item, 'resume')"
            >
              Retomar</button
            ><button v-if="!item.archivedAt" class="secondary" @click="action(item, 'generate')">
              Gerar agora</button
            ><button v-if="!item.archivedAt" class="danger" @click="action(item, 'archive')">
              Arquivar
            </button>
          </div>
        </article>
      </div>
    </section>
    <div v-if="showTemplates" class="backdrop" @click.self="closeTemplates">
      <section
        ref="templateDialog"
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
      >
        <h2 id="template-title">Usar modelo</h2>
        <label v-if="activeTemplates.length >= 8"
          >Buscar modelos<input v-model="templateSearch" type="search"
        /></label>
        <p v-if="!activeTemplates.length">Nenhum modelo ativo.</p>
        <p v-else-if="!filteredTemplates.length">Nenhum modelo encontrado para esta busca.</p>
        <button
          v-for="template in filteredTemplates"
          :key="template.id"
          type="button"
          class="template-option"
          @click="chooseTemplate(template)"
        >
          <b>{{ template.name }}</b
          ><span>{{ template.description }} · {{ template.plannedAmount }}</span>
        </button>
        <button type="button" class="secondary" @click="closeTemplates">Cancelar</button>
      </section>
    </div>
    <div v-if="showConfirm" class="backdrop">
      <section
        ref="confirmDialog"
        class="confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-title"
      >
        <h2 id="replace-title">Substituir campos?</h2>
        <p>Aplicar este modelo e substituir os campos já preenchidos?</p>
        <div class="actions">
          <button type="button" class="secondary" @click="cancelTemplate">Cancelar</button
          ><button type="button" @click="confirmTemplate">Aplicar modelo</button>
        </div>
      </section>
    </div>
  </main>
</template>
<style scoped>
.recurrences {
  width: min(100%, 72rem);
  padding: 2rem;
  color: #172033;
}
.eyebrow {
  color: #155eef;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.panel,
.empty,
article {
  background: white;
  border: 1px solid #dce3ef;
  border-radius: 16px;
  padding: 1.25rem;
  margin: 1rem 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
.wide {
  grid-column: 1/-1;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
textarea {
  min-height: 5rem;
}
.cards {
  display: grid;
  gap: 1rem;
}
article {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.template-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: #0f172a88;
}
.sheet,
.confirm {
  width: min(100%, 30rem);
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  padding: 1rem;
  border-radius: 1rem;
  background: white;
}
.template-option {
  width: 100%;
  display: grid;
  margin: 0.5rem 0;
  text-align: left;
}
.template-option span {
  overflow-wrap: anywhere;
  font-size: 0.85rem;
}
.secondary {
  background: #e8efff;
  color: #173b7a;
}
.danger {
  background: #b42318;
}
.link {
  background: transparent;
  color: #155eef;
  padding: 0.2rem;
}
.badge {
  background: #e8efff;
  color: #173b7a;
  border-radius: 99px;
  padding: 0.25rem 0.6rem;
}
.warning {
  color: #b54708;
  font-weight: 700;
}
.archived {
  opacity: 0.65;
}
@media (max-width: 700px) {
  .recurrences {
    padding: 1rem;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
  article {
    display: block;
  }
  .backdrop {
    align-items: end;
    padding: 0;
  }
  .sheet {
    border-radius: 1rem 1rem 0 0;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
}
</style>
