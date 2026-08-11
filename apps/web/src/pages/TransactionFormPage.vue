<script setup lang="ts">
/* global Event, HTMLButtonElement, HTMLElement, KeyboardEvent, window */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  FinancialTransactionType,
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicTransactionTemplate,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { filterActiveTemplates, normalizeMoney, templateDefaults } from '../transaction-template';

const route = useRoute(),
  router = useRouter();
const loading = ref(false),
  error = ref(''),
  templateWarning = ref(''),
  templates = ref<PublicTransactionTemplate[]>([]);
const accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]);
const selectedTemplate = ref<PublicTransactionTemplate | null>(null),
  pendingTemplate = ref<PublicTransactionTemplate | null>(null);
const showTemplates = ref(false),
  showConfirm = ref(false),
  showDiscardConfirm = ref(false),
  detailsOpen = ref(false),
  dirty = ref(false);
const templateSearch = ref('');
const templateTrigger = ref<HTMLButtonElement | null>(null),
  templateDialog = ref<HTMLElement | null>(null),
  confirmDialog = ref<HTMLElement | null>(null),
  discardDialog = ref<HTMLElement | null>(null);
const form = reactive({
  type: (route.query.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as FinancialTransactionType,
  status: 'PENDING',
  plannedAmount: '',
  description: '',
  dueDate: '',
  accountId: '',
  categoryId: '',
  actualAmount: '',
  paidAt: '',
  notes: '',
});
const compatibleCategories = computed(() =>
  categories.value.filter((c) => !c.archivedAt && c.type === form.type),
);
const activeTemplates = computed(() => filterActiveTemplates(templates.value, ''));
const filteredTemplates = computed(() =>
  filterActiveTemplates(templates.value, templateSearch.value),
);
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(safeApiErrorMessage(body, 'Não foi possível concluir a operação.'));
  return body as T;
}
async function openTemplates() {
  templateSearch.value = '';
  showTemplates.value = true;
  await nextTick();
  templateDialog.value?.querySelector<HTMLElement>('input, button')?.focus();
}
function closeTemplates() {
  showTemplates.value = false;
  void nextTick(() => templateTrigger.value?.focus());
}
function apply(template: PublicTransactionTemplate) {
  const now = new Date();
  Object.assign(form, templateDefaults(template, now.getFullYear(), now.getMonth() + 1));
  selectedTemplate.value = template;
  templateWarning.value = '';
  if (!template.categoryAvailable)
    templateWarning.value +=
      'A categoria do modelo não está disponível. Escolha uma categoria ativa. ';
  if (template.defaultAccountId && !template.defaultAccountAvailable)
    templateWarning.value += 'A conta padrão não está disponível. Escolha uma conta ativa.';
  dirty.value = false;
  closeTemplates();
}
function choose(template: PublicTransactionTemplate) {
  if (dirty.value || selectedTemplate.value) {
    pendingTemplate.value = template;
    showConfirm.value = true;
    return;
  }
  apply(template);
}
function confirmTemplate() {
  if (pendingTemplate.value) apply(pendingTemplate.value);
  pendingTemplate.value = null;
  showConfirm.value = false;
}
function cancelTemplate() {
  pendingTemplate.value = null;
  showConfirm.value = false;
  void nextTick(() => templateDialog.value?.querySelector<HTMLElement>('input, button')?.focus());
}
function requestLeave() {
  if (!dirty.value) {
    router.back();
    return;
  }
  showDiscardConfirm.value = true;
}
function confirmDiscard() {
  dirty.value = false;
  showDiscardConfirm.value = false;
  router.back();
}
function cancelDiscard() {
  showDiscardConfirm.value = false;
}
function closeTopDialog() {
  if (showDiscardConfirm.value) cancelDiscard();
  else if (showConfirm.value) cancelTemplate();
  else if (showTemplates.value) closeTemplates();
  else return false;
  return true;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && closeTopDialog()) event.preventDefault();
}
function onAndroidBack(event: Event) {
  if (closeTopDialog()) {
    event.preventDefault();
    return;
  }
  if (dirty.value) {
    showDiscardConfirm.value = true;
    event.preventDefault();
  }
}
function removeTemplate() {
  selectedTemplate.value = null;
}
async function save() {
  error.value = '';
  const plannedAmount = normalizeMoney(form.plannedAmount);
  if (
    !plannedAmount ||
    !form.description.trim() ||
    !form.dueDate ||
    !form.accountId ||
    !form.categoryId
  ) {
    error.value = 'Preencha valor, descrição, vencimento, conta e categoria.';
    return;
  }
  const actualAmount = form.status === 'PAID' ? normalizeMoney(form.actualAmount) : null;
  if (form.status === 'PAID' && (!actualAmount || !form.paidAt)) {
    error.value = 'Informe o valor realizado e a data do pagamento.';
    return;
  }
  loading.value = true;
  try {
    await api('/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: form.accountId,
        categoryId: form.categoryId,
        type: form.type,
        status: form.status,
        description: form.description.trim(),
        notes: form.notes || null,
        plannedAmount,
        dueDate: form.dueDate,
        ...(form.status === 'PAID' ? { actualAmount, paidAt: form.paidAt } : {}),
      }),
    });
    await router.replace('/transactions');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao salvar.';
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  try {
    [accounts.value, categories.value, templates.value] = await Promise.all([
      api<PublicFinancialAccount[]>('/accounts'),
      api<PublicFinancialCategory[]>('/categories'),
      api<PublicTransactionTemplate[]>('/transaction-templates'),
    ]);
  } catch {
    error.value = 'Não foi possível carregar os dados do formulário.';
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
});
watch(
  () => form.type,
  () => {
    if (!compatibleCategories.value.some((category) => category.id === form.categoryId))
      form.categoryId = '';
  },
);
watch(showConfirm, async (visible) => {
  if (!visible) return;
  await nextTick();
  confirmDialog.value?.querySelector<HTMLElement>('button')?.focus();
});
watch(showDiscardConfirm, async (visible) => {
  if (!visible) return;
  await nextTick();
  discardDialog.value?.querySelector<HTMLElement>('button')?.focus();
});
</script>
<template>
  <main class="form-page">
    <header>
      <button class="back" aria-label="Voltar" @click="requestLeave">‹</button>
      <h1>Novo lançamento</h1>
    </header>
    <form novalidate @submit.prevent="save" @input="dirty = true">
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="template-action">
        <button ref="templateTrigger" type="button" class="secondary" @click="openTemplates">
          Usar modelo...</button
        ><span v-if="selectedTemplate"
          >Modelo: {{ selectedTemplate.name }}
          <button type="button" class="link" @click="removeTemplate">Remover</button></span
        >
      </div>
      <p v-if="templateWarning" class="warning" role="alert">{{ templateWarning }}</p>
      <label
        >Natureza<select v-model="form.type">
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select></label
      >
      <label
        >Valor previsto<input v-model="form.plannedAmount" inputmode="decimal" required
      /></label>
      <label>Descrição<input v-model="form.description" maxlength="200" required /></label>
      <label>Vencimento<input v-model="form.dueDate" type="date" required /></label>
      <label
        >Conta<select v-model="form.accountId" required>
          <option value="">Selecione</option>
          <option v-for="a in accounts.filter((a) => !a.archivedAt)" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select></label
      >
      <label
        >Categoria<select v-model="form.categoryId" required>
          <option value="">Selecione</option>
          <option v-for="c in compatibleCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select></label
      >
      <label
        >Estado<select v-model="form.status">
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
        </select></label
      >
      <template v-if="form.status === 'PAID'"
        ><label>Valor realizado<input v-model="form.actualAmount" inputmode="decimal" /></label
        ><label>Data do pagamento<input v-model="form.paidAt" type="date" /></label
      ></template>
      <button type="button" class="details" @click="detailsOpen = !detailsOpen">
        {{ detailsOpen ? 'Ocultar detalhes' : 'Mais detalhes' }}
      </button>
      <label v-if="detailsOpen">Notas<textarea v-model="form.notes" maxlength="2000" /></label>
      <div class="save">
        <button type="button" class="secondary" @click="requestLeave">Cancelar</button
        ><button :disabled="loading" type="submit">{{ loading ? 'Salvando…' : 'Salvar' }}</button>
      </div>
    </form>
    <div v-if="showTemplates" class="backdrop" @click.self="closeTemplates">
      <section
        ref="templateDialog"
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-dialog-title"
      >
        <h2 id="template-dialog-title">Usar modelo</h2>
        <label v-if="activeTemplates.length >= 8"
          >Buscar modelos<input v-model="templateSearch" type="search"
        /></label>
        <p v-if="!activeTemplates.length">Nenhum modelo ativo.</p>
        <p v-else-if="!filteredTemplates.length">Nenhum modelo encontrado para esta busca.</p>
        <button v-for="t in filteredTemplates" :key="t.id" class="template" @click="choose(t)">
          <b>{{ t.name }}</b
          ><span>{{ t.description }} · {{ t.plannedAmount }}</span></button
        ><button class="secondary" @click="closeTemplates">Cancelar</button>
      </section>
    </div>
    <div v-if="showConfirm" class="backdrop">
      <section
        ref="confirmDialog"
        class="confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-dialog-title"
      >
        <h2 id="replace-dialog-title">Substituir campos?</h2>
        <p>Aplicar este modelo e substituir os campos já preenchidos?</p>
        <div>
          <button class="secondary" @click="cancelTemplate">Cancelar</button
          ><button @click="confirmTemplate">Aplicar modelo</button>
        </div>
      </section>
    </div>
    <div v-if="showDiscardConfirm" class="backdrop">
      <section
        ref="discardDialog"
        class="confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-dialog-title"
      >
        <h2 id="discard-dialog-title">Descartar rascunho?</h2>
        <p>As alterações não salvas serão perdidas.</p>
        <div>
          <button class="secondary" @click="cancelDiscard">Cancelar</button
          ><button @click="confirmDiscard">Descartar</button>
        </div>
      </section>
    </div>
  </main>
</template>
<style scoped>
.form-page {
  width: min(100%, 42rem);
  margin: 0 auto;
  padding: 1.5rem;
}
.form-page > header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.back {
  width: 2.75rem;
  padding: 0;
  font-size: 2rem;
  background: transparent;
  color: #0f172a;
}
.form-page form {
  padding: 1.25rem;
  background: #fff;
  border-radius: 1rem;
}
.template-action,
.save,
.confirm div {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}
.secondary,
.details {
  background: #e2e8f0;
  color: #0f172a;
}
.link {
  min-height: 44px;
  background: transparent;
  color: #155eef;
  text-decoration: underline;
}
.warning {
  padding: 0.75rem;
  background: #fff4e5;
  color: #854d0e;
}
.save {
  position: sticky;
  bottom: 0;
  padding-top: 0.75rem;
  padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
  background: #fff;
}
.save button {
  flex: 1;
}
.backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  background: #0f172a88;
  padding: 1rem;
}
.sheet,
.confirm {
  width: min(100%, 30rem);
  background: #fff;
  padding: 1rem;
  border-radius: 1rem;
}
.template {
  width: 100%;
  display: grid;
  text-align: left;
  margin: 0.5rem 0;
}
.template span {
  font-size: 0.85rem;
}
@media (max-width: 767px) {
  .form-page {
    padding: 0;
  }
  .form-page form {
    border-radius: 0.75rem;
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
