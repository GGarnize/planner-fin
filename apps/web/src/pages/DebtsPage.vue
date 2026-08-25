<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any, no-undef */
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type {
  FinancialDebtDetail,
  ListFinancialDebtsResponse,
  PublicFinancialAccount,
  PublicFinancialDebt,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import PageHeader from '../components/PageHeader.vue';
import { normalizeMoney } from '../transaction-template';
const route = useRoute(),
  router = useRouter(),
  items = ref<PublicFinancialDebt[]>([]),
  detail = ref<FinancialDebtDetail | null>(null),
  accounts = ref<PublicFinancialAccount[]>([]),
  loading = ref(true),
  busy = ref(false),
  error = ref(''),
  nextCursor = ref<string | null>(null),
  showForm = ref(false),
  editing = ref(false);
const filters = reactive({ status: '', type: '', due: 'all', archived: 'false' });
const form = reactive<any>({
  type: 'LOAN',
  creditorName: '',
  description: '',
  notes: '',
  originalPrincipal: '',
  startDate: '',
  installmentCount: 1,
  installments: [
    {
      installmentNumber: 1,
      dueDate: '',
      principalAmount: '',
      interestAmount: '',
      feeAmount: '',
    },
  ],
  funding: { accountId: '', amount: '', fundingDate: '' },
});
const pay = reactive({ installmentId: '', accountId: '', paymentDate: '' });
const money = (v: string) => {
  const match = /^(\d+)\.(\d{2})$/.exec(v);
  if (!match) return v;
  return `R$ ${match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${match[2]}`;
};
const activeAccounts = computed(() => accounts.value.filter((a) => !a.archivedAt));
async function json<T>(path: string, init?: RequestInit) {
  let r: Response;
  try {
    r = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const d = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) throw new Error(d.error?.message ?? 'Não foi possível continuar.');
  return d as T;
}
async function load(append = false) {
  loading.value = true;
  error.value = '';
  try {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    p.set('limit', '20');
    if (append && nextCursor.value) p.set('cursor', nextCursor.value);
    const d = await json<ListFinancialDebtsResponse>(`/debts?${p}`);
    items.value = append ? [...items.value, ...d.items] : d.items;
    nextCursor.value = d.nextCursor;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
async function loadDetail(id: string) {
  loading.value = true;
  error.value = '';
  try {
    detail.value = await json(`/debts/${id}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
function resize() {
  const n = Math.max(1, Math.min(600, Number(form.installmentCount) || 1));
  form.installments = Array.from(
    { length: n },
    (_, i) =>
      form.installments[i] ?? {
        installmentNumber: i + 1,
        dueDate: '',
        principalAmount: '',
        interestAmount: '',
        feeAmount: '',
      },
  ).map((x: any, i: number) => ({ ...x, installmentNumber: i + 1 }));
}
function normalizeOptionalZeroMoney(value: string) {
  return value.trim() ? normalizeMoney(value, { allowZero: true }) : '0.00';
}
function canonicalInstallments() {
  return form.installments.map((item: any) => {
    const principalAmount = normalizeMoney(item.principalAmount);
    const interestAmount = normalizeOptionalZeroMoney(item.interestAmount);
    const feeAmount = normalizeOptionalZeroMoney(item.feeAmount);
    if (!principalAmount || !interestAmount || !feeAmount) return null;
    return {
      ...item,
      principalAmount,
      interestAmount,
      feeAmount,
    };
  });
}
function canonicalDebtBody() {
  const originalPrincipal = normalizeMoney(form.originalPrincipal);
  if (!originalPrincipal)
    throw new Error('Informe um valor principal válido, ex.: 1000 ou 1.000,50.');
  const installments = canonicalInstallments();
  if (installments.some((item: unknown) => !item))
    throw new Error('Revise os valores das parcelas. Use exemplos como 1000, 1000,50 ou 0,00.');
  const body: any = {
    ...form,
    originalPrincipal,
    installmentCount: Number(form.installmentCount),
    installments,
    description: form.description,
    notes: form.notes || null,
  };
  if (body.type === 'LOAN') {
    const amount = normalizeMoney(form.funding.amount);
    if (!amount) throw new Error('Informe um valor de funding válido, ex.: 1000 ou 1.000,50.');
    body.funding = { ...form.funding, amount };
  } else delete body.funding;
  return body;
}
async function create() {
  busy.value = true;
  error.value = '';
  try {
    const body = canonicalDebtBody();
    await json('/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function action(id: string, kind: 'archive' | 'restore') {
  try {
    await json(`/debts/${id}/${kind}`, { method: 'POST' });
    if (detail.value) await loadDetail(id);
    else await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
function beginEdit() {
  if (!detail.value) return;
  const d = detail.value;
  Object.assign(form, {
    type: d.type,
    creditorName: d.creditorName,
    description: d.description,
    notes: d.notes ?? '',
    originalPrincipal: d.originalPrincipal,
    startDate: d.startDate,
    installmentCount: d.installmentCount,
    installments: d.installments.map((x) => ({
      installmentNumber: x.installmentNumber,
      dueDate: x.dueDate,
      principalAmount: x.principalAmount,
      interestAmount: x.interestAmount === '0.00' ? '' : x.interestAmount,
      feeAmount: x.feeAmount === '0.00' ? '' : x.feeAmount,
    })),
    funding: d.funding
      ? {
          accountId: d.funding.accountId,
          amount: d.funding.amount,
          fundingDate: d.funding.fundingDate,
        }
      : { accountId: '', amount: '', fundingDate: '' },
  });
  editing.value = true;
  error.value = '';
}
async function saveEdit() {
  if (!detail.value) return;
  busy.value = true;
  error.value = '';
  try {
    const body: any = {
      creditorName: form.creditorName,
      description: form.description,
      notes: form.notes || null,
    };
    if (!detail.value.payments.length) {
      const aggregate = canonicalDebtBody();
      Object.assign(body, {
        type: aggregate.type,
        originalPrincipal: aggregate.originalPrincipal,
        startDate: aggregate.startDate,
        installmentCount: aggregate.installmentCount,
        installments: aggregate.installments,
      });
      if (aggregate.type === 'LOAN') body.funding = aggregate.funding;
    }
    detail.value = await json(`/debts/${detail.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    editing.value = false;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function payInstallment() {
  busy.value = true;
  try {
    await json(`/debt-installments/${pay.installmentId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: pay.accountId, paymentDate: pay.paymentDate }),
    });
    pay.installmentId = '';
    await loadDetail(String(route.params.id));
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    accounts.value = await json('/accounts');
  } catch {
    accounts.value = [];
  }
  if (route.params.id) await loadDetail(String(route.params.id));
  else await load();
});
</script>
<template>
  <main class="debts">
    <PageHeader
      :title="detail ? 'Detalhe da dívida' : 'Dívidas e financiamentos'"
      description="Acompanhe principal, custos e vencimentos sem dupla contagem."
      :back-to="detail ? '/debts' : '/mais'"
    >
      <template v-if="!detail" #action>
        <button @click="showForm = !showForm">{{ showForm ? 'Fechar' : 'Nova dívida' }}</button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <button class="link" @click="route.params.id ? loadDetail(String(route.params.id)) : load()">
        Tentar novamente
      </button>
    </p>
    <p v-if="loading">Carregando dívidas…</p>
    <section v-if="!detail && !loading">
      <form v-if="showForm" class="panel" @submit.prevent="create">
        <h2>Novo contrato</h2>
        <div class="grid">
          <label
            >Tipo<select v-model="form.type">
              <option value="LOAN">Empréstimo</option>
              <option value="FINANCING">Financiamento</option>
              <option value="NEGOTIATED_DEBT">Dívida negociada</option>
              <option value="OTHER">Outra</option>
            </select></label
          ><label>Credor<input v-model="form.creditorName" required maxlength="120" /></label
          ><label
            >Valor principal<input
              v-model="form.originalPrincipal"
              inputmode="decimal"
              required
              placeholder="1.000,50" /></label
          ><label>Data inicial<input v-model="form.startDate" type="date" required /></label
          ><label
            >Quantidade<input
              v-model.number="form.installmentCount"
              type="number"
              min="1"
              max="600"
              required
              @change="resize" /></label
          ><label>Descrição<input v-model="form.description" required maxlength="200" /></label>
        </div>
        <label>Notas<textarea v-model="form.notes" maxlength="2000"></textarea></label>
        <fieldset v-if="form.type === 'LOAN'">
          <legend>Funding integral do empréstimo</legend>
          <div class="grid">
            <label
              >Conta<select v-model="form.funding.accountId" required>
                <option value="">Selecione</option>
                <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
                  {{ a.name }} ·
                  {{
                    a.realizedBalance === null
                      ? 'saldo atual indisponível'
                      : money(a.realizedBalance)
                  }}
                </option>
              </select></label
            ><label
              >Valor<input
                v-model="form.funding.amount"
                inputmode="decimal"
                placeholder="0,00"
                required /></label
            ><label>Data<input v-model="form.funding.fundingDate" type="date" required /></label>
          </div>
        </fieldset>
        <h3>Parcelas</h3>
        <div v-for="x in form.installments" :key="x.installmentNumber" class="installment">
          <b>Parcela {{ x.installmentNumber }}</b>
          <label class="installment-field"
            >Vencimento<input v-model="x.dueDate" type="date" required
          /></label>
          <label class="installment-field"
            >Amortização<input
              v-model="x.principalAmount"
              inputmode="decimal"
              placeholder="0,00"
              required
          /></label>
          <label class="installment-field"
            >Juros<input v-model="x.interestAmount" inputmode="decimal" placeholder="0,00"
          /></label>
          <label class="installment-field"
            >Tarifa<input v-model="x.feeAmount" inputmode="decimal" placeholder="0,00"
          /></label>
        </div>
        <p v-if="form.type === 'FINANCING'" class="notice">
          O ativo ou bem financiado e sua despesa não são reconhecidos automaticamente.
        </p>
        <button :disabled="busy">{{ busy ? 'Salvando…' : 'Cadastrar dívida' }}</button>
      </form>
      <div class="filters">
        <select v-model="filters.status" @change="load()">
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="PAID_OFF">Quitadas</option></select
        ><select v-model="filters.type" @change="load()">
          <option value="">Todos os tipos</option>
          <option value="LOAN">Empréstimo</option>
          <option value="FINANCING">Financiamento</option>
          <option value="NEGOTIATED_DEBT">Negociada</option>
          <option value="OTHER">Outra</option></select
        ><select v-model="filters.due" @change="load()">
          <option value="all">Todos os vencimentos</option>
          <option value="overdue">Em atraso</option>
          <option value="upcoming">A vencer</option></select
        ><select v-model="filters.archived" aria-label="Arquivamento" @change="load()">
          <option value="false">Não arquivadas</option>
          <option value="true">Arquivadas</option>
          <option value="all">Todas</option>
        </select>
      </div>
      <div v-if="!items.length && !error" class="empty">
        <h2>Nenhuma dívida encontrada</h2>
        <p>Cadastre um contrato com cronograma explícito para começar.</p>
      </div>
      <article v-for="x in items" :key="x.id" class="debt">
        <div>
          <span class="badge" :class="x.status">{{
            x.status === 'ACTIVE' ? 'Ativa' : 'Quitada'
          }}</span>
          <h2>
            <a @click="router.push(`/debts/${x.id}`)">{{ x.creditorName }}</a>
          </h2>
          <p>{{ x.type }} · {{ x.installmentCount }} parcela(s)</p>
        </div>
        <div>
          <small>Saldo devedor</small
          ><strong>{{ money(x.projections.outstandingPrincipal) }}</strong
          ><small v-if="x.projections.nextInstallment"
            >Próxima: {{ x.projections.nextInstallment.dueDate }}
            <b v-if="x.projections.nextInstallment.projectedStatus === 'OVERDUE'"
              >· em atraso</b
            ></small
          >
        </div>
        <button
          v-if="x.status === 'PAID_OFF' && !x.archivedAt"
          class="secondary"
          @click="action(x.id, 'archive')"
        >
          Arquivar</button
        ><button v-if="x.archivedAt" class="secondary" @click="action(x.id, 'restore')">
          Restaurar
        </button>
      </article>
      <button v-if="nextCursor" @click="load(true)">Carregar mais</button>
    </section>
    <section v-if="detail && !loading" class="detail">
      <div class="metrics">
        <div>
          <small>Saldo devedor</small
          ><strong>{{ money(detail.projections.outstandingPrincipal) }}</strong>
        </div>
        <div>
          <small>Principal pago</small
          ><strong>{{ money(detail.projections.paidPrincipal) }}</strong>
        </div>
        <div>
          <small>Juros pagos</small
          ><strong>{{ money(detail.projections.paidInterestAmount) }}</strong>
          <small>Tarifas pagas</small><strong>{{ money(detail.projections.paidFeeAmount) }}</strong>
        </div>
        <div>
          <small>Custos pendentes</small>
          <span>Juros {{ money(detail.projections.pendingInterestAmount) }}</span>
          <span> · tarifas {{ money(detail.projections.pendingFeeAmount) }}</span>
        </div>
        <div>
          <small>Total futuro</small
          ><strong>{{ money(detail.projections.totalFutureAmount) }}</strong>
        </div>
      </div>
      <div class="panel">
        <h2>{{ detail.creditorName }}</h2>
        <p>
          Status: <b>{{ detail.status }}</b> · início {{ detail.startDate }}
        </p>
        <p v-if="detail.funding">
          Funding: {{ money(detail.funding.amount) }} em {{ detail.funding.fundingDate }}
        </p>
        <p>
          Próxima parcela:
          <b>{{ detail.projections.nextInstallment?.dueDate ?? 'nenhuma' }}</b> · vencidas:
          <b>{{ detail.projections.overdueInstallmentCount }}</b>
        </p>
        <div v-if="!editing" class="actions">
          <button v-if="!detail.archivedAt" class="secondary" @click="beginEdit">Editar</button>
          <button
            v-if="detail.status === 'PAID_OFF' && !detail.archivedAt"
            class="secondary"
            @click="action(detail.id, 'archive')"
          >
            Arquivar
          </button>
          <button v-if="detail.archivedAt" class="secondary" @click="action(detail.id, 'restore')">
            Restaurar
          </button>
        </div>
        <form v-if="editing" class="edit" @submit.prevent="saveEdit">
          <h3>Editar contrato</h3>
          <div class="grid">
            <label>Credor<input v-model="form.creditorName" required maxlength="120" /></label>
            <label>Descrição<input v-model="form.description" required maxlength="200" /></label>
            <label>Notas<textarea v-model="form.notes" maxlength="2000"></textarea></label>
          </div>
          <template v-if="!detail.payments.length">
            <div class="grid">
              <label
                >Tipo<select v-model="form.type">
                  <option value="LOAN">Empréstimo</option>
                  <option value="FINANCING">Financiamento</option>
                  <option value="NEGOTIATED_DEBT">Dívida negociada</option>
                  <option value="OTHER">Outra</option>
                </select></label
              >
              <label
                >Valor principal<input
                  v-model="form.originalPrincipal"
                  inputmode="decimal"
                  placeholder="1.000,50"
                  required
              /></label>
              <label>Data inicial<input v-model="form.startDate" type="date" required /></label>
              <label
                >Quantidade<input
                  v-model.number="form.installmentCount"
                  type="number"
                  min="1"
                  max="600"
                  required
                  @change="resize"
              /></label>
            </div>
            <fieldset v-if="form.type === 'LOAN'">
              <legend>Funding integral</legend>
              <select v-model="form.funding.accountId" required>
                <option value="">Conta</option>
                <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
              <input
                v-model="form.funding.amount"
                aria-label="Valor do funding"
                inputmode="decimal"
                placeholder="0,00"
                required
              />
              <input
                v-model="form.funding.fundingDate"
                aria-label="Data do funding"
                type="date"
                required
              />
            </fieldset>
            <div v-for="x in form.installments" :key="x.installmentNumber" class="installment">
              <b>Parcela {{ x.installmentNumber }}</b>
              <label class="installment-field"
                >Vencimento<input v-model="x.dueDate" type="date" required
              /></label>
              <label class="installment-field"
                >Amortização<input
                  v-model="x.principalAmount"
                  inputmode="decimal"
                  placeholder="0,00"
                  required
              /></label>
              <label class="installment-field"
                >Juros<input v-model="x.interestAmount" inputmode="decimal" placeholder="0,00"
              /></label>
              <label class="installment-field"
                >Tarifa<input v-model="x.feeAmount" inputmode="decimal" placeholder="0,00"
              /></label>
            </div>
          </template>
          <p v-else class="notice">
            Após o primeiro pagamento, somente credor, descrição e notas podem ser alterados.
          </p>
          <button :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar alterações' }}</button>
          <button type="button" class="secondary" :disabled="busy" @click="editing = false">
            Cancelar
          </button>
        </form>
        <p class="notice">
          O principal pago reduz a dívida e o saldo da conta, mas não é nova despesa; juros e
          tarifas pagos são custo financeiro.
        </p>
      </div>
      <div class="panel">
        <h2>Parcelas</h2>
        <div v-for="x in detail.installments" :key="x.id" class="schedule">
          <span
            >Parcela {{ x.installmentNumber }} · {{ x.dueDate }}
            <b>{{
              x.projectedStatus === 'OVERDUE'
                ? 'Em atraso'
                : x.projectedStatus === 'PAID'
                  ? 'Pago'
                  : 'Pendente'
            }}</b></span
          ><strong>{{ money(x.totalAmount) }}</strong
          ><button
            v-if="x.status === 'PENDING' && !detail.archivedAt"
            class="secondary"
            @click="pay.installmentId = x.id"
          >
            Pagar integral</button
          ><span v-else>{{ x.status === 'PAID' ? 'Pago' : 'Pendente' }}</span>
          <form v-if="pay.installmentId === x.id" class="pay" @submit.prevent="payInstallment">
            <select v-model="pay.accountId" required>
              <option value="">Conta pagadora</option>
              <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
                {{ a.name }}
              </option></select
            ><input v-model="pay.paymentDate" type="date" required /><button :disabled="busy">
              {{ busy ? 'Pagando…' : 'Confirmar' }}
            </button>
          </form>
        </div>
      </div>
      <div class="panel">
        <h2>Histórico</h2>
        <p v-if="!detail.payments.length">Nenhum pagamento realizado.</p>
        <p v-for="p in detail.payments" :key="p.id">
          {{ p.paymentDate }} · {{ money(p.totalAmount) }} (principal
          {{ money(p.principalAmount) }}; juros {{ money(p.interestAmount) }}; tarifa
          {{ money(p.feeAmount) }})
        </p>
      </div>
    </section>
  </main>
</template>
<style scoped>
.debts {
  width: min(1100px, 100%);
  padding: 2rem;
  color: var(--color-text);
}
.debt,
.schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.panel,
.debt,
.empty {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem;
  margin: 1rem 0;
  box-shadow: var(--shadow-surface);
}
.grid,
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.installment {
  display: grid;
  grid-template-columns: 5rem repeat(4, minmax(0, 1fr));
  align-items: end;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.installment-field {
  min-width: 0;
  color: var(--color-text-muted);
  font-size: 0.82rem;
}
.installment-field input {
  width: 100%;
}
.filters {
  display: flex;
  gap: 0.75rem;
  margin: 1rem 0;
  flex-wrap: wrap;
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
.debt strong,
.metrics strong {
  display: block;
  font-size: 1.35rem;
}
.badge {
  padding: 0.3rem 0.6rem;
  border-radius: 99px;
  background: var(--color-warning-container);
  color: var(--color-warning);
}
.badge.PAID_OFF {
  background: var(--color-success-container);
  color: var(--color-success);
}
.secondary {
  background: var(--color-accent-container);
  color: var(--color-on-accent-container);
}
.notice {
  background: var(--color-surface-muted);
  color: var(--color-text);
  padding: 1rem;
  border-radius: 0.5rem;
}
.schedule {
  border-top: 1px solid var(--color-border);
  padding: 1rem 0;
  flex-wrap: wrap;
}
.pay {
  display: flex;
  margin: 0;
  gap: 0.5rem;
}
.link {
  background: none;
  color: var(--color-error);
  text-decoration: underline;
  padding: 0;
}
a {
  cursor: pointer;
  color: var(--color-accent);
}
@media (max-width: 650px) {
  .debt {
    align-items: stretch;
    flex-direction: column;
  }
  .installment {
    grid-template-columns: 1fr;
  }
  .pay {
    flex-direction: column;
  }
  .debts {
    padding: 1rem;
  }
}
</style>
