<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type {
  PaginatedCardInvoicesResponse,
  PaginatedCardPurchasesResponse,
  PublicCardInvoice,
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicFinancialCreditCard,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
const cards = ref<PublicFinancialCreditCard[]>([]),
  purchases = ref<PaginatedCardPurchasesResponse['data']>([]),
  invoices = ref<PublicCardInvoice[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]),
  loading = ref(true),
  saving = ref(false),
  error = ref('');
const card = reactive({
  name: '',
  issuer: '',
  last4: '',
  creditLimit: '',
  closingDay: 10,
  dueDay: 17,
});
const purchase = reactive({
  cardId: '',
  categoryId: '',
  description: '',
  notes: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  totalAmount: '',
  installmentCount: 1,
});
const payment = reactive<Record<string, { accountId: string; paymentDate: string }>>({});
const activeCards = computed(() => cards.value.filter((x) => !x.archivedAt)),
  activeAccounts = computed(() => accounts.value.filter((x) => !x.archivedAt)),
  expenseCategories = computed(() =>
    categories.value.filter((x) => !x.archivedAt && x.type === 'EXPENSE'),
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
    const [c, p, i, a, g] = await Promise.all([
      api<PublicFinancialCreditCard[]>('/cards?includeArchived=true'),
      api<PaginatedCardPurchasesResponse>('/card-purchases?limit=100'),
      api<PaginatedCardInvoicesResponse>('/card-invoices?limit=100'),
      api<PublicFinancialAccount[]>('/accounts?includeArchived=true'),
      api<PublicFinancialCategory[]>('/categories?includeArchived=true'),
    ]);
    cards.value = c;
    purchases.value = p.data;
    invoices.value = i.data;
    accounts.value = a;
    categories.value = g;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
async function createCard() {
  await mutate('/cards', {
    ...card,
    issuer: card.issuer || null,
    last4: card.last4 || null,
    creditLimit: card.creditLimit || null,
  });
  Object.assign(card, {
    name: '',
    issuer: '',
    last4: '',
    creditLimit: '',
    closingDay: 10,
    dueDay: 17,
  });
}
async function createPurchase() {
  await mutate('/card-purchases', {
    ...purchase,
    notes: purchase.notes || null,
    installmentCount: Number(purchase.installmentCount),
  });
  Object.assign(purchase, { description: '', notes: '', totalAmount: '', installmentCount: 1 });
}
async function mutate(path: string, body?: object) {
  saving.value = true;
  error.value = '';
  try {
    await api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha na operação.';
  } finally {
    saving.value = false;
  }
}
async function toggle(item: PublicFinancialCreditCard) {
  await mutate(`/cards/${item.id}/${item.archivedAt ? 'restore' : 'archive'}`);
}
function pay(invoice: PublicCardInvoice) {
  const data = payment[invoice.id] ?? {
    accountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  };
  payment[invoice.id] = data;
  return mutate(`/card-invoices/${invoice.id}/pay`, data);
}
const money = (v: string | null) =>
  v
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    : '—';
onMounted(load);
</script>
<template>
  <main class="cards-page">
    <header>
      <p class="eyebrow">Crédito sem dupla contagem</p>
      <h1>Cartões e faturas</h1>
      <p>Compras representam despesas. O pagamento da fatura apenas reduz o saldo da conta.</p>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load">Tentar novamente</button>
    </p>
    <p v-if="loading">Carregando cartões e faturas…</p>
    <template v-else
      ><section class="panel">
        <h2>Novo cartão</h2>
        <form @submit.prevent="createCard">
          <div class="grid">
            <label>Nome<input v-model="card.name" maxlength="120" required /></label
            ><label>Emissor<input v-model="card.issuer" maxlength="120" /></label
            ><label
              >Últimos 4 dígitos<input
                v-model="card.last4"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{4}" /></label
            ><label>Limite informativo<input v-model="card.creditLimit" placeholder="0.00" /></label
            ><label
              >Dia de fechamento<input
                v-model.number="card.closingDay"
                type="number"
                min="1"
                max="31"
                required /></label
            ><label
              >Dia de vencimento<input
                v-model.number="card.dueDay"
                type="number"
                min="1"
                max="31"
                required
            /></label>
          </div>
          <button :disabled="saving">Cadastrar cartão</button>
        </form>
      </section>
      <section>
        <h2>Seus cartões</h2>
        <p v-if="!cards.length" class="empty">
          Nenhum cartão cadastrado. Cadastre o primeiro acima.
        </p>
        <div class="tiles">
          <article v-for="item in cards" :key="item.id" :class="{ archived: item.archivedAt }">
            <h3>{{ item.name }}</h3>
            <p>
              {{ item.issuer || 'Emissor não informado' }} ·
              {{ item.last4 ? `•••• ${item.last4}` : 'Final não informado' }}
            </p>
            <p>Limite informativo: {{ money(item.creditLimit) }}</p>
            <p>Fecha dia {{ item.closingDay }} · vence dia {{ item.dueDay }}</p>
            <button class="secondary" @click="toggle(item)">
              {{ item.archivedAt ? 'Restaurar' : 'Arquivar' }}
            </button>
          </article>
        </div>
      </section>
      <section class="panel">
        <h2>Nova compra</h2>
        <form @submit.prevent="createPurchase">
          <div class="grid">
            <label
              >Cartão<select v-model="purchase.cardId" required>
                <option value="">Selecione</option>
                <option v-for="x in activeCards" :key="x.id" :value="x.id">{{ x.name }}</option>
              </select></label
            ><label
              >Categoria de despesa<select v-model="purchase.categoryId" required>
                <option value="">Selecione</option>
                <option v-for="x in expenseCategories" :key="x.id" :value="x.id">
                  {{ x.name }}
                </option>
              </select></label
            ><label
              >Descrição<input v-model="purchase.description" maxlength="200" required /></label
            ><label>Data<input v-model="purchase.purchaseDate" type="date" required /></label
            ><label
              >Valor total<input
                v-model="purchase.totalAmount"
                placeholder="100.00"
                required /></label
            ><label
              >Parcelas<input
                v-model.number="purchase.installmentCount"
                type="number"
                min="1"
                max="36"
                required /></label
            ><label class="wide">Notas<textarea v-model="purchase.notes" maxlength="2000" /></label>
          </div>
          <button :disabled="saving">Lançar compra</button>
        </form>
      </section>
      <section>
        <h2>Compras e parcelas futuras</h2>
        <p v-if="!purchases.length" class="empty">Nenhuma compra no cartão.</p>
        <article v-for="x in purchases" :key="x.id">
          <h3>{{ x.description }} · {{ money(x.totalAmount) }}</h3>
          <p>{{ x.installmentCount }}x · compra em {{ x.purchaseDate }}</p>
          <ul>
            <li v-for="i in x.installments" :key="i.id">
              {{ i.installmentNumber }}/{{ i.installmentCount }} — {{ money(i.amount) }} — fatura
              {{ i.referenceMonth }}
            </li>
          </ul>
        </article>
      </section>
      <section>
        <h2>Faturas</h2>
        <p v-if="!invoices.length" class="empty">Nenhuma fatura materializada.</p>
        <article v-for="x in invoices" :key="x.id">
          <span class="badge">{{ x.status }}</span>
          <h3>{{ x.referenceMonth }} · {{ money(x.total) }}</h3>
          <p>Fecha {{ x.closingDate }} · vence {{ x.dueDate }}</p>
          <ul>
            <li v-for="i in x.installments" :key="i.id">
              {{ i.purchaseDescription }} — {{ money(i.amount) }}
            </li>
          </ul>
          <button v-if="x.status === 'OPEN'" @click="mutate(`/card-invoices/${x.id}/close`)">
            Fechar fatura
          </button>
          <div v-if="x.status === 'CLOSED'" class="pay">
            <p>
              <strong>O pagamento reduz o saldo da conta e não registra uma nova despesa.</strong>
            </p>
            <label
              >Conta pagadora<select
                v-model="
                  (payment[x.id] ??= {
                    accountId: '',
                    paymentDate: new Date().toISOString().slice(0, 10),
                  }).accountId
                "
              >
                <option value="">Selecione</option>
                <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
                  {{ a.name }} · saldo {{ money(a.realizedBalance) }}
                </option>
              </select></label
            ><label>Data<input v-model="payment[x.id]!.paymentDate" type="date" /></label
            ><button :disabled="!payment[x.id]?.accountId" @click="pay(x)">
              Pagar integralmente
            </button>
          </div>
          <p v-if="x.status === 'PAID'">
            Paga em {{ x.payment?.paymentDate }} pela conta selecionada.
          </p>
        </article>
      </section></template
    >
  </main>
</template>
<style scoped>
.cards-page {
  width: min(100%, 75rem);
  padding: 1rem;
}
.panel,
article,
.empty {
  background: #fff;
  border-radius: 1rem;
  padding: 1.25rem;
  margin: 1rem 0;
  box-shadow: 0 0.3rem 1rem #0f172a12;
}
.grid,
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1rem;
}
.wide {
  grid-column: 1/-1;
}
.archived {
  opacity: 0.65;
}
.badge {
  font-weight: 700;
  color: #155eef;
}
.secondary,
.link {
  background: #e8efff;
  color: #174ea6;
}
.pay {
  border-top: 1px solid #cbd5e1;
  margin-top: 1rem;
  padding-top: 1rem;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
  width: 100%;
}
@media (max-width: 600px) {
  .cards-page {
    padding: 0.5rem;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
