<script setup lang="ts">
/* global Event, File, HTMLElement, HTMLInputElement, KeyboardEvent, window */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  ImportPreviewResponse,
  OpenImportSessionResponse,
  ImportRowResponse,
  ImportSessionResponse,
  PublicFinancialAccount,
  PublicFinancialCategory,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { importApi, ImportApiError, type ImportFilter } from '../import-api';

const route = useRoute();
const router = useRouter();
const accounts = ref<PublicFinancialAccount[]>([]);
const categories = ref<PublicFinancialCategory[]>([]);
const session = ref<ImportSessionResponse | null>(null);
const drafts = ref<OpenImportSessionResponse[]>([]);
const rows = ref<ImportRowResponse[]>([]);
const selectedFile = ref<File | null>(null);
const accountId = ref('');
const format = ref<'OFX' | 'CSV'>('CSV');
const loading = ref(false);
const error = ref('');
const filter = ref<ImportFilter>('all');
const preview = ref<ImportPreviewResponse | null>(null);
const confirmation = ref<{ createdCount: number; income: string; expense: string } | null>(null);
const editing = ref<ImportRowResponse | null>(null);
const cancelOpen = ref(false);
const editDialog = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
let confirmationKey: string | null = null;

const mapping = reactive({
  delimiter: ',',
  header: true,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: ',',
  thousandsSeparator: '.',
  valueMode: 'amount' as 'amount' | 'split',
  date: 0,
  description: 1,
  amount: 2,
  debit: 2,
  credit: 3,
  type: '' as number | '',
  externalId: '' as number | '',
  externalIdReliable: false,
});
const edit = reactive({
  description: '',
  date: '',
  amount: '',
  type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
  categoryId: '',
  selected: true,
  probableOverride: false,
  possibleAccepted: false,
});
const filters: Array<{ key: ImportFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'valid', label: 'Válidos' },
  { key: 'warning', label: 'Com aviso' },
  { key: 'duplicate', label: 'Duplicados' },
  { key: 'selected', label: 'Selecionados' },
];
const activeAccounts = computed(() =>
  accounts.value.filter((item) => !item.archivedAt && item.currency === 'BRL'),
);
const mappingRequired = computed(() => session.value?.status === 'MAPPING_REQUIRED');
const review = computed(() => session.value?.status === 'READY_FOR_REVIEW');
const readOnly = computed(() =>
  ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(session.value?.status ?? ''),
);
const compatibleCategories = computed(() =>
  categories.value.filter((item) => !item.archivedAt && item.type === edit.type),
);
const net = computed(() => {
  if (!preview.value) return '0,00';
  return (
    Number(preview.value.totals.income) - Number(preview.value.totals.expense)
  ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
});
const money = (value: string | null) =>
  value ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const duplicateLabel = (value: ImportRowResponse['duplicateClassification']) =>
  ({
    NONE: '',
    STRONG: 'Duplicidade forte — bloqueada, sem override',
    PROBABLE: 'Duplicado provável — aceite individual obrigatório',
    POSSIBLE: 'Possível duplicado — aceite explícito obrigatório',
  })[value];
const countFor = (key: ImportFilter) => {
  if (key === filter.value) return session.value?.page.filteredCount ?? 0;
  if (key === 'all') return session.value?.rowCount ?? 0;
  return '—';
};
const csvColumns = computed(() => session.value?.csvSample?.columns ?? []);
const columnLabel = (index: number) => {
  const column = csvColumns.value.find((item) => item.index === index);
  if (!column) return `Coluna ${index + 1}`;
  const header = (mapping.header ? column.header : '') || `Coluna ${index + 1}`;
  return column.samples[0] ? `${header} — ex.: ${column.samples[0]}` : header;
};
const updatedLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const day =
    date.toLocaleDateString('pt-BR') === today.toLocaleDateString('pt-BR')
      ? 'hoje'
      : `em ${date.toLocaleDateString('pt-BR')}`;
  return `Atualizado ${day} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

async function baseApi<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(path);
  if (!response.ok) throw new Error('Não foi possível carregar contas e categorias.');
  return response.json() as Promise<T>;
}
async function loadRelations() {
  try {
    [accounts.value, categories.value] = await Promise.all([
      baseApi<PublicFinancialAccount[]>('/accounts'),
      baseApi<PublicFinancialCategory[]>('/categories'),
    ]);
    if (!accountId.value && activeAccounts.value.length)
      accountId.value = activeAccounts.value[0]!.id;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  }
}
async function loadDrafts() {
  try {
    drafts.value = await importApi.listOpen();
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : 'Não foi possível carregar as importações em andamento.';
  }
}
async function continueDraft(id: string) {
  loading.value = true;
  error.value = '';
  try {
    applySession(await importApi.get(id, 'all'));
    await router.replace(`/imports/${id}`);
  } catch (reason) {
    handle(reason, false);
    if (reason instanceof ImportApiError && reason.code === 'IMPORT_NOT_FOUND') await loadDrafts();
  } finally {
    loading.value = false;
  }
}
function applySession(value: ImportSessionResponse, append = false) {
  session.value = value;
  rows.value = append ? [...rows.value, ...value.rows] : value.rows;
  accountId.value = value.accountId;
  format.value = value.format;
  preview.value = null;
  confirmationKey = null;
}
async function reload(append = false) {
  if (!session.value && typeof route.params.id !== 'string') return;
  loading.value = true;
  error.value = '';
  try {
    const id = session.value?.id ?? String(route.params.id);
    applySession(await importApi.get(id, filter.value, append ? rows.value.length : 0), append);
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  selectedFile.value = file;
  if (file) format.value = file.name.toLocaleLowerCase().endsWith('.ofx') ? 'OFX' : 'CSV';
}
async function upload() {
  if (!selectedFile.value || !accountId.value) {
    error.value = 'Escolha o arquivo e uma conta ativa.';
    return;
  }
  const extension = selectedFile.value.name.toLocaleLowerCase();
  if (!extension.endsWith('.ofx') && !extension.endsWith('.csv')) {
    error.value = 'Use somente arquivos OFX ou CSV.';
    return;
  }
  if (selectedFile.value.size > 10 * 1024 * 1024) {
    error.value = 'O arquivo excede o limite de 10 MiB.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const value = await importApi.upload(
      selectedFile.value,
      accountId.value,
      format.value,
      mapping.delimiter,
    );
    applySession(value);
    await router.replace(`/imports/${value.id}`);
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
async function saveMapping() {
  if (!session.value) return;
  const columns: Record<string, number> = { date: mapping.date, description: mapping.description };
  if (mapping.valueMode === 'amount') columns.amount = mapping.amount;
  else {
    columns.debit = mapping.debit;
    columns.credit = mapping.credit;
  }
  if (mapping.type !== '') columns.type = mapping.type;
  if (mapping.externalId !== '') columns.externalId = mapping.externalId;
  loading.value = true;
  error.value = '';
  try {
    applySession(
      await importApi.mapping(session.value.id, session.value.draftVersion, {
        version: 1,
        delimiter: mapping.delimiter,
        header: mapping.header,
        dateFormat: mapping.dateFormat,
        decimalSeparator: mapping.decimalSeparator,
        thousandsSeparator: mapping.thousandsSeparator || null,
        columns,
        externalIdReliable: mapping.externalIdReliable,
      }),
    );
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
function openEdit(row: ImportRowResponse) {
  editing.value = row;
  Object.assign(edit, row, {
    description: row.description ?? '',
    date: row.date ?? '',
    amount: row.amount ?? '',
    type: row.type ?? 'EXPENSE',
    categoryId: row.categoryId ?? '',
  });
  void nextTick(() => editDialog.value?.focus());
}
function closeTop() {
  if (cancelOpen.value) {
    cancelOpen.value = false;
    return true;
  }
  if (editing.value) {
    editing.value = null;
    return true;
  }
  if (preview.value) {
    preview.value = null;
    confirmationKey = null;
    return true;
  }
  return false;
}
async function saveRow() {
  if (!session.value || !editing.value) return;
  loading.value = true;
  error.value = '';
  try {
    applySession(
      await importApi.patchRow(session.value.id, editing.value.id, {
        draftVersion: session.value.draftVersion,
        ...edit,
      }),
    );
    editing.value = null;
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
async function makePreview() {
  if (!session.value) return;
  loading.value = true;
  error.value = '';
  try {
    preview.value = await importApi.preview(session.value.id, session.value.draftVersion);
    confirmationKey = null;
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
async function confirmImport() {
  if (!session.value || !preview.value) return;
  confirmationKey ??= globalThis.crypto.randomUUID();
  loading.value = true;
  error.value = '';
  try {
    const result = await importApi.confirm(
      session.value.id,
      preview.value.draftVersion,
      preview.value.previewToken,
      confirmationKey,
    );
    confirmation.value = {
      createdCount: result.createdCount,
      income: preview.value.totals.income,
      expense: preview.value.totals.expense,
    };
    session.value.status = 'CONFIRMED';
    preview.value = null;
  } catch (reason) {
    handle(reason, false);
  } finally {
    loading.value = false;
  }
}
async function cancelImport() {
  if (!session.value) return;
  loading.value = true;
  error.value = '';
  try {
    await importApi.cancel(session.value.id, session.value.draftVersion);
    cancelOpen.value = false;
    await router.replace('/mais');
  } catch (reason) {
    handle(reason);
  } finally {
    loading.value = false;
  }
}
function handle(reason: unknown, refreshOnStale = true) {
  error.value = reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.';
  if (
    refreshOnStale &&
    reason instanceof ImportApiError &&
    ['IMPORT_VERSION_CONFLICT', 'IMPORT_DRAFT_STALE'].includes(reason.code)
  )
    void reload();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && closeTop()) event.preventDefault();
}
function onAndroidBack(event: Event) {
  if (closeTop()) event.preventDefault();
}
watch(filter, () => void reload());
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack);
  void loadRelations();
  if (typeof route.params.id === 'string') void reload();
  else void loadDrafts();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack);
});
</script>

<template>
  <main class="import-page">
    <header>
      <router-link to="/mais" aria-label="Voltar para Mais">←</router-link>
      <div>
        <h1>Importar extrato</h1>
        <p>Revise antes de criar qualquer lançamento.</p>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button class="link" @click="reload()">Tentar novamente</button>
    </p>
    <p v-if="loading" aria-live="polite">Processando…</p>

    <template v-if="!session">
      <section v-if="drafts.length" class="panel drafts" aria-labelledby="drafts-title">
        <h2 id="drafts-title">Importação em andamento</h2>
        <article v-for="draft in drafts" :key="draft.id">
          <div>
            <strong>{{ draft.displayFileName || 'Arquivo sem nome' }}</strong>
            <p>{{ updatedLabel(draft.updatedAt) }}</p>
          </div>
          <button class="secondary" :disabled="loading" @click="continueDraft(draft.id)">
            Continuar
          </button>
        </article>
      </section>
      <section class="panel upload-step">
        <h2>1. Arquivo e conta</h2>
        <h3 v-if="drafts.length">Nova importação</h3>
        <p>OFX ou CSV · máximo de 10 MiB e 10.000 linhas · codificação UTF-8.</p>
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".ofx,.csv,text/csv,application/x-ofx"
          @change="chooseFile"
        />
        <button class="file-button secondary" @click="fileInput?.click()">
          Escolher arquivo OFX ou CSV
        </button>
        <p v-if="selectedFile">
          <strong>Arquivo:</strong> {{ selectedFile.name.split(/[\\/]/).pop() }}<br /><strong
            >Formato detectado:</strong
          >
          {{ format }}
        </p>
        <label
          >Conta ativa<select v-model="accountId" required>
            <option value="" disabled>Selecione</option>
            <option v-for="account in activeAccounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </select></label
        >
        <p v-if="!activeAccounts.length">
          Você precisa de uma conta ativa em BRL.
          <router-link to="/accounts?return=/imports">Cadastrar conta</router-link>
        </p>
        <button :disabled="loading || !selectedFile || !accountId" @click="upload">
          Enviar arquivo
        </button>
      </section></template
    >

    <section v-else-if="mappingRequired" class="panel mapping-step">
      <h2>2. Mapear CSV</h2>
      <p>
        Escolha cada coluna pelo nome e por uma amostra. O índice continua sendo enviado ao
        servidor, sem inferência automática.
      </p>
      <div class="form-grid">
        <label
          >Delimitador<select v-model="mapping.delimiter">
            <option value=",">Vírgula</option>
            <option value=";">Ponto e vírgula</option>
            <option :value="'\t'">Tabulação</option>
          </select></label
        >
        <label class="check"
          ><input v-model="mapping.header" type="checkbox" /> Primeira linha é cabeçalho</label
        >
        <label
          >Formato de data<select v-model="mapping.dateFormat">
            <option>DD/MM/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select></label
        >
        <label
          >Separador decimal<select v-model="mapping.decimalSeparator">
            <option value=",">Vírgula</option>
            <option value=".">Ponto</option>
          </select></label
        >
        <label
          >Separador de milhar<select v-model="mapping.thousandsSeparator">
            <option value="">Nenhum</option>
            <option value=".">Ponto</option>
            <option value=",">Vírgula</option>
          </select></label
        >
        <label
          >Data<select v-model.number="mapping.date">
            <option v-for="column in csvColumns" :key="column.index" :value="column.index">
              {{ columnLabel(column.index) }}
            </option>
          </select></label
        >
        <label
          >Descrição<select v-model.number="mapping.description">
            <option v-for="column in csvColumns" :key="column.index" :value="column.index">
              {{ columnLabel(column.index) }}
            </option>
          </select></label
        >
        <fieldset>
          <legend>Colunas de valor</legend>
          <label class="check"
            ><input v-model="mapping.valueMode" type="radio" value="amount" /> Valor único</label
          ><label class="check"
            ><input v-model="mapping.valueMode" type="radio" value="split" /> Débito e
            crédito</label
          >
        </fieldset>
        <label v-if="mapping.valueMode === 'amount'"
          >Valor<select v-model.number="mapping.amount">
            <option v-for="column in csvColumns" :key="column.index" :value="column.index">
              {{ columnLabel(column.index) }}
            </option>
          </select></label
        >
        <template v-else
          ><label
            >Débito<select v-model.number="mapping.debit">
              <option v-for="column in csvColumns" :key="column.index" :value="column.index">
                {{ columnLabel(column.index) }}
              </option>
            </select></label
          ><label
            >Crédito<select v-model.number="mapping.credit">
              <option v-for="column in csvColumns" :key="column.index" :value="column.index">
                {{ columnLabel(column.index) }}
              </option>
            </select></label
          ></template
        >
        <label
          >Natureza (opcional)<select v-model="mapping.type">
            <option value="">Não mapear</option>
            <option v-for="column in csvColumns" :key="column.index" :value="column.index">
              {{ columnLabel(column.index) }}
            </option>
          </select></label
        >
        <label
          >External ID (opcional)<select v-model="mapping.externalId">
            <option value="">Não mapear</option>
            <option v-for="column in csvColumns" :key="column.index" :value="column.index">
              {{ columnLabel(column.index) }}
            </option>
          </select></label
        >
        <label class="check"
          ><input v-model="mapping.externalIdReliable" type="checkbox" /> External ID é
          confiável</label
        >
      </div>
      <button :disabled="loading" @click="saveMapping">Aplicar mapping e revisar</button>
    </section>

    <template v-else-if="review">
      <section class="review-head">
        <div>
          <h2>3. Revisão</h2>
          <p>{{ session.displayFileName }} · {{ session.rowCount }} linhas</p>
        </div>
        <button class="danger secondary" @click="cancelOpen = true">Cancelar importação</button>
      </section>
      <nav class="chips" aria-label="Filtros da revisão">
        <button
          v-for="item in filters"
          :key="item.key"
          :class="{ active: filter === item.key }"
          :aria-pressed="filter === item.key"
          @click="filter = item.key"
        >
          {{ item.label }} ({{ countFor(item.key) }})
        </button>
      </nav>
      <section class="rows" aria-label="Linhas do extrato">
        <article
          v-for="row in rows"
          :key="row.id"
          :class="{ blocked: row.validationStatus === 'BLOCKED' }"
        >
          <div class="row-title">
            <span>Linha {{ row.rowNumber }}</span
            ><strong>{{ money(row.amount) }}</strong>
          </div>
          <h3>{{ row.description || 'Descrição pendente' }}</h3>
          <p>
            {{ row.date || 'Data pendente' }} ·
            {{
              row.type === 'INCOME'
                ? 'Entrada'
                : row.type === 'EXPENSE'
                  ? 'Despesa'
                  : 'Natureza pendente'
            }}
          </p>
          <p v-if="row.warnings.length" class="warning">⚠ Avisos: {{ row.warnings.join(', ') }}</p>
          <p v-if="row.duplicateClassification !== 'NONE'" class="warning">
            ⚠ {{ duplicateLabel(row.duplicateClassification) }}
          </p>
          <p>
            Categoria:
            {{ categories.find((c) => c.id === row.categoryId)?.name || 'Não selecionada' }} ·
            {{ row.selected ? 'Selecionada' : 'Não selecionada' }}
          </p>
          <button class="secondary" @click="openEdit(row)">Revisar linha</button>
        </article>
      </section>
      <button
        v-if="rows.length < session.page.filteredCount"
        class="secondary load-more"
        @click="reload(true)"
      >
        Carregar mais
      </button>
      <aside class="review-action">
        <span>{{ rows.filter((row) => row.selected).length }} selecionadas nesta página</span
        ><button :disabled="loading" @click="makePreview">Revisar resumo</button>
      </aside>
    </template>

    <section v-else-if="session.status === 'CONFIRMED'" class="panel success" aria-live="polite">
      <h2>Importação concluída</h2>
      <p>
        <strong>{{ confirmation?.createdCount ?? session.rowCount }}</strong> lançamentos criados.
      </p>
      <template v-if="confirmation"
        ><p>Entradas: {{ money(confirmation.income) }}</p>
        <p>Despesas: {{ money(confirmation.expense) }}</p></template
      ><router-link class="button-link" to="/transactions">Ver lançamentos</router-link>
    </section>
    <section v-else-if="readOnly" class="panel">
      <h2>Sessão encerrada</h2>
      <p>Estado: {{ session.status }}. Nenhuma ação será reenviada.</p>
      <router-link to="/mais">Voltar para Mais</router-link>
    </section>

    <div v-if="editing" class="backdrop" @click.self="editing = null">
      <form
        ref="editDialog"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        tabindex="-1"
        @submit.prevent="saveRow"
      >
        <h2 id="edit-title">Revisar linha {{ editing.rowNumber }}</h2>
        <div class="dialog-body">
          <label
            >Selecionar<input
              v-model="edit.selected"
              type="checkbox"
              :disabled="editing.duplicateClassification === 'STRONG'" /></label
          ><label>Data<input v-model="edit.date" type="date" required /></label
          ><label>Descrição<input v-model="edit.description" maxlength="200" required /></label
          ><label>Valor<input v-model="edit.amount" inputmode="decimal" required /></label
          ><label
            >Natureza<select v-model="edit.type">
              <option value="INCOME">Entrada</option>
              <option value="EXPENSE">Despesa</option>
            </select></label
          ><label
            >Categoria<select v-model="edit.categoryId" required>
              <option value="" disabled>Selecione</option>
              <option
                v-for="category in compatibleCategories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select></label
          >
          <p v-if="editing.duplicateClassification === 'STRONG'" class="warning">
            ⚠ Duplicidade forte bloqueada. Não é possível sobrescrever.
          </p>
          <label v-if="editing.duplicateClassification === 'PROBABLE'" class="check"
            ><input v-model="edit.probableOverride" type="checkbox" /> Aceito importar este
            duplicado provável</label
          ><label v-if="editing.duplicateClassification === 'POSSIBLE'" class="check"
            ><input v-model="edit.possibleAccepted" type="checkbox" /> Revisei e aceito este
            possível duplicado</label
          >
        </div>
        <div class="actions">
          <button type="button" class="secondary" @click="editing = null">Fechar</button
          ><button :disabled="loading">Salvar revisão</button>
        </div>
      </form>
    </div>
    <div v-if="preview" class="backdrop" @click.self="preview = null">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <h2 id="preview-title">Resumo antes de importar</h2>
        <div class="dialog-body">
          <p>
            <strong>{{ preview.counts.selected }}</strong> de {{ preview.counts.total }} linhas
            selecionadas
          </p>
          <p>
            Entradas: <strong>{{ money(preview.totals.income) }}</strong>
          </p>
          <p>
            Despesas: <strong>{{ money(preview.totals.expense) }}</strong>
          </p>
          <p>
            Saldo líquido: <strong>{{ net }}</strong>
          </p>
          <p v-if="preview.counts.probable + preview.counts.possible" class="warning">
            ⚠ Avisos aceitos: {{ preview.counts.probable + preview.counts.possible }}
          </p>
        </div>
        <div class="actions">
          <button
            class="secondary"
            @click="
              preview = null;
              confirmationKey = null;
            "
          >
            Voltar à revisão</button
          ><button :disabled="loading || !preview.counts.selected" @click="confirmImport">
            Importar {{ preview.counts.selected }} lançamentos
          </button>
        </div>
      </section>
    </div>
    <div v-if="cancelOpen" class="backdrop" @click.self="cancelOpen = false">
      <section class="dialog" role="dialog" aria-modal="true">
        <h2>Cancelar importação?</h2>
        <p>Nenhum lançamento será criado.</p>
        <div class="actions">
          <button class="secondary" @click="cancelOpen = false">Continuar revisão</button
          ><button class="danger" @click="cancelImport">Cancelar importação</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.import-page {
  width: min(100%, 64rem);
  margin: 0 auto;
  padding: 2rem;
}
.import-page > header,
.review-head,
.row-title,
.actions,
.review-action {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}
.import-page > header a {
  font-size: 1.5rem;
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  text-decoration: none;
}
.import-page h1,
.import-page header p {
  margin: 0.2rem 0;
}
.panel,
.rows article,
.review-head {
  background: var(--color-surface);
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: var(--shadow-surface);
}
.panel {
  display: grid;
  gap: 1rem;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
fieldset {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
}
.check input {
  min-height: 24px;
  width: 24px;
}
.rows {
  display: grid;
  gap: 0.75rem;
}
.rows article {
  border-left: 5px solid var(--color-success);
}
.rows article.blocked {
  border-left-color: var(--color-error);
}
.rows h3 {
  margin: 0.4rem 0;
}
.warning {
  color: var(--color-warning);
  font-weight: 650;
}
.chips {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.75rem 0;
}
.chips button {
  white-space: nowrap;
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.chips button.active {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
.review-action {
  position: sticky;
  bottom: calc(var(--shell-nav-height) + env(safe-area-inset-bottom));
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  z-index: 10;
}
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  background: var(--color-overlay);
}
.dialog {
  width: min(100%, 34rem);
  max-height: calc(100dvh - 2rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border-radius: 1rem;
  overflow: hidden;
}
.dialog-body {
  overflow: auto;
  display: grid;
  gap: 0.75rem;
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.danger {
  background: var(--color-error);
  color: white;
}
.link {
  padding: 0.2rem;
  background: none;
  color: var(--color-error);
  text-decoration: underline;
}
.button-link {
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: 0.7rem;
  border-radius: 0.5rem;
  background: var(--color-accent);
  color: var(--color-on-accent);
  text-decoration: none;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.file-button {
  width: 100%;
}
.error {
  padding: 0.75rem;
  background: var(--color-error-container);
  border: 1px solid var(--color-error-border);
  border-radius: 0.5rem;
}
.load-more {
  width: 100%;
  margin-top: 1rem;
}
.drafts article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}
.drafts article p {
  margin: 0.25rem 0 0;
}
@media (max-width: 767px) {
  .import-page {
    padding: 0;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .review-head {
    align-items: stretch;
    flex-direction: column;
  }
  .review-action {
    bottom: calc(var(--shell-nav-height) + env(safe-area-inset-bottom));
  }
  .actions {
    flex-wrap: wrap;
  }
  .actions button {
    flex: 1 1 10rem;
  }
}
@media (min-width: 768px) {
  .review-action {
    bottom: 1rem;
  }
}
</style>
