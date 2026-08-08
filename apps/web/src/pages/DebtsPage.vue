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
      interestAmount: '0.00',
      feeAmount: '0.00',
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
        interestAmount: '0.00',
        feeAmount: '0.00',
      },
  ).map((x: any, i: number) => ({ ...x, installmentNumber: i + 1 }));
}
async function create() {
  busy.value = true;
  error.value = '';
  try {
    const body: any = { ...form, description: form.description, notes: form.notes || null };
    if (body.type !== 'LOAN') delete body.funding;
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
      interestAmount: x.interestAmount,
      feeAmount: x.feeAmount,
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
      Object.assign(body, {
        type: form.type,
        originalPrincipal: form.originalPrincipal,
        startDate: form.startDate,
        installmentCount: form.installmentCount,
        installments: form.installments,
      });
      if (form.type === 'LOAN') body.funding = form.funding;
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
    <header>
      <div>
        <p class="eyebrow">PLANEJAMENTO FINANCEIRO</p>
        <h1>{{ detail ? 'Detalhe da dívida' : 'Dívidas e financiamentos' }}</h1>
        <p>Acompanhe principal, custos e vencimentos sem dupla contagem.</p>
      </div>
      <button v-if="!detail" @click="showForm = !showForm">
        {{ showForm ? 'Fechar' : 'Nova dívida' }}</button
      ><button v-else class="secondary" @click="router.push('/debts')">Voltar</button>
    </header>
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
            >Principal<input
              v-model="form.originalPrincipal"
              inputmode="decimal"
              required
              placeholder="1000.00" /></label
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
                  {{ a.name }} · {{ money(a.realizedBalance) }}
                </option>
              </select></label
            ><label>Valor<input v-model="form.funding.amount" inputmode="decimal" required /></label
            ><label>Data<input v-model="form.funding.fundingDate" type="date" required /></label>
          </div>
        </fieldset>
        <h3>Cronograma explícito</h3>
        <div v-for="x in form.installments" :key="x.installmentNumber" class="installment">
          <b>#{{ x.installmentNumber }}</b
          ><input v-model="x.dueDate" type="date" aria-label="Vencimento" required /><input
            v-model="x.principalAmount"
            inputmode="decimal"
            placeholder="Principal"
            required
          /><input
            v-model="x.interestAmount"
            inputmode="decimal"
            placeholder="Juros"
            required
          /><input v-model="x.feeAmount" inputmode="decimal" placeholder="Tarifa" required />
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
              <label>Principal<input v-model="form.originalPrincipal" required /></label>
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
              <input v-model="form.funding.amount" aria-label="Valor do funding" required />
              <input
                v-model="form.funding.fundingDate"
                aria-label="Data do funding"
                type="date"
                required
              />
            </fieldset>
            <div v-for="x in form.installments" :key="x.installmentNumber" class="installment">
              <b>#{{ x.installmentNumber }}</b
              ><input v-model="x.dueDate" type="date" required /><input
                v-model="x.principalAmount"
                required
              /><input v-model="x.interestAmount" required /><input
                v-model="x.feeAmount"
                required
              />
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
        <h2>Cronograma</h2>
        <div v-for="x in detail.installments" :key="x.id" class="schedule">
          <span
            >#{{ x.installmentNumber }} · {{ x.dueDate }}
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
  color: #172033;
}
header,
.debt,
.schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.eyebrow {
  color: #155eef;
  font-weight: 700;
  font-size: 0.75rem;
}
.panel,
.debt,
.empty {
  background: white;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  padding: 1.25rem;
  margin: 1rem 0;
}
.grid,
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.installment {
  display: grid;
  grid-template-columns: 45px repeat(4, 1fr);
  gap: 0.5rem;
  margin: 0.5rem 0;
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
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
.debt strong,
.metrics strong {
  display: block;
  font-size: 1.35rem;
}
.badge {
  padding: 0.3rem 0.6rem;
  border-radius: 99px;
  background: #fff0c2;
}
.badge.PAID_OFF {
  background: #d7f5df;
}
.secondary {
  background: #e8efff;
  color: #1549a3;
}
.notice {
  background: #eef4ff;
  padding: 1rem;
  border-radius: 0.5rem;
}
.schedule {
  border-top: 1px solid #e5eaf1;
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
  color: #b42318;
  text-decoration: underline;
  padding: 0;
}
a {
  cursor: pointer;
  color: #1549a3;
}
@media (max-width: 650px) {
  header,
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
