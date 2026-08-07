<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type {
  FinancialTransferStatus,
  PublicFinancialAccount,
  PublicFinancialTransfer,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
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
  loading.value = true;
  error.value = '';
  const body: Record<string, unknown> = editing.value
    ? { description: form.description, notes: form.notes || null }
    : { ...form, notes: form.notes || null };
  if (editing.value?.status === 'PENDING')
    Object.assign(body, {
      sourceAccountId: form.sourceAccountId,
      destinationAccountId: form.destinationAccountId,
      plannedAmount: form.plannedAmount,
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
  try {
    await api(`/transfers/${completing.value.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeForm),
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
onMounted(async () => {
  try {
    accounts.value = await api('/accounts');
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  }
  await load();
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
        <div class="actions">
          <button type="button" class="secondary" @click="showForm = false">Cancelar</button
          ><button :disabled="loading">Salvar</button>
        </div>
      </form>
    </div>
    <div v-if="completing" class="modal" role="dialog" aria-modal="true">
      <form @submit.prevent="complete">
        <h2>Concluir transferência</h2>
        <label
          >Valor realizado<input
            v-model="completeForm.actualAmount"
            inputmode="decimal"
            required /></label
        ><label
          >Data de conclusão<input v-model="completeForm.completedAt" type="date" required
        /></label>
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
