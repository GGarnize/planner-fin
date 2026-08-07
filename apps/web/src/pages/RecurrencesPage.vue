<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type {
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicRecurrence,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
const items = ref<PublicRecurrence[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]),
  loading = ref(true),
  saving = ref(false),
  error = ref(''),
  editing = ref<PublicRecurrence | null>(null);
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
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]) {
  let response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'Não foi possível concluir.');
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
function payload() {
  const base = {
    frequency: form.frequency,
    startDate: form.startDate,
    endDate: form.endDate || null,
    plannedAmount: form.plannedAmount,
    description: form.description,
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
const money = (v: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
onMounted(load);
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
      <form @submit.prevent="save">
        <div class="grid">
          <label
            >Tipo<select v-model="form.kind" :disabled="!!editing">
              <option value="TRANSACTION">Lançamento</option>
              <option value="TRANSFER">Transferência</option>
            </select></label
          ><label
            >Frequência<select v-model="form.frequency">
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
              <option value="YEARLY">Anual</option>
            </select></label
          ><label>Início<input v-model="form.startDate" type="date" required /></label
          ><label>Fim (opcional)<input v-model="form.endDate" type="date" /></label
          ><label v-if="form.frequency === 'WEEKLY'"
            >Dia da semana<select v-model.number="form.dayOfWeek">
              <option v-for="n in 7" :key="n" :value="n">{{ n }}</option>
            </select></label
          ><label v-else
            >Dia do mês<input
              v-model.number="form.dayOfMonth"
              type="number"
              min="1"
              max="31"
              required /></label
          ><label v-if="form.frequency === 'YEARLY'"
            >Mês<input
              v-model.number="form.monthOfYear"
              type="number"
              min="1"
              max="12"
              required /></label
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
}
</style>
