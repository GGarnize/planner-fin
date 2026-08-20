<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type {
  PaginatedCardInvoicesResponse,
  PaginatedCardPurchasesResponse,
  PublicCardInvoice,
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicFinancialCreditCard,
  UpdateCardPurchaseRequest,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { normalizeMoney } from '../transaction-template';
import CategoryIcon from '../components/CategoryIcon.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import KebabMenu, { type KebabMenuAction } from '../components/KebabMenu.vue';
const cards = ref<PublicFinancialCreditCard[]>([]),
  purchases = ref<PaginatedCardPurchasesResponse['items']>([]),
  invoices = ref<PublicCardInvoice[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]),
  loading = ref(true),
  saving = ref(false),
  loadingPurchases = ref(false),
  loadingInvoices = ref(false),
  purchaseCursor = ref<string | null>(null),
  invoiceCursor = ref<string | null>(null),
  error = ref('');
const showCardForm = ref(false);
const showPurchaseForm = ref(false);
const payingInvoiceId = ref('');
const deletingPurchase = ref<PaginatedCardPurchasesResponse['items'][number] | null>(null);
const deletingPurchaseBusy = ref(false);
const deletePurchaseError = ref('');
const route = useRoute();
const contextualCardId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
);
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
const editingCardId = ref('');
const editingPurchaseId = ref('');
const originalPurchase = ref<PaginatedCardPurchasesResponse['items'][number] | null>(null);
const editCard = reactive({
  name: '',
  issuer: '',
  last4: '',
  creditLimit: '',
  closingDay: 1,
  dueDay: 1,
});
const editPurchase = reactive({
  cardId: '',
  categoryId: '',
  description: '',
  notes: '',
  purchaseDate: '',
  totalAmount: '',
  installmentCount: 1,
});
const activeCards = computed(() => cards.value.filter((x) => !x.archivedAt)),
  cardNameById = computed(() => new Map(cards.value.map((item) => [item.id, item.name]))),
  categoryById = computed(() => new Map(categories.value.map((item) => [item.id, item]))),
  editablePurchaseCards = computed(() =>
    cards.value.filter((x) => !x.archivedAt || x.id === originalPurchase.value?.cardId),
  ),
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
      api<{ items: PublicFinancialCreditCard[] }>('/cards?archived=true'),
      api<PaginatedCardPurchasesResponse>(
        `/card-purchases?limit=20${contextualCardId.value ? `&cardId=${contextualCardId.value}` : ''}`,
      ),
      api<PaginatedCardInvoicesResponse>(
        `/card-invoices?limit=20${contextualCardId.value ? `&cardId=${contextualCardId.value}` : ''}`,
      ),
      api<PublicFinancialAccount[]>('/accounts?includeArchived=true'),
      api<PublicFinancialCategory[]>('/categories?includeArchived=true'),
    ]);
    cards.value = c.items;
    purchases.value = p.items;
    invoices.value = i.items;
    purchaseCursor.value = p.nextCursor;
    invoiceCursor.value = i.nextCursor;
    accounts.value = a;
    categories.value = g;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
async function loadMore(kind: 'purchases' | 'invoices') {
  const cursor = kind === 'purchases' ? purchaseCursor : invoiceCursor;
  const busy = kind === 'purchases' ? loadingPurchases : loadingInvoices;
  if (!cursor.value || busy.value) return;
  busy.value = true;
  try {
    const base = kind === 'purchases' ? 'card-purchases' : 'card-invoices';
    const page = await api<PaginatedCardPurchasesResponse | PaginatedCardInvoicesResponse>(
      `/${base}?limit=20&cursor=${encodeURIComponent(cursor.value)}${contextualCardId.value ? `&cardId=${contextualCardId.value}` : ''}`,
    );
    if (kind === 'purchases') purchases.value.push(...(page.items as typeof purchases.value));
    else invoices.value.push(...(page.items as typeof invoices.value));
    cursor.value = page.nextCursor;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha na paginação.';
  } finally {
    busy.value = false;
  }
}
async function createCard() {
  if (card.creditLimit && !normalizeMoney(card.creditLimit)) {
    error.value = 'Informe um limite válido, ex.: 5000 ou 5000,00.';
    return;
  }
  const ok = await mutate('/cards', {
    ...card,
    issuer: card.issuer || null,
    last4: card.last4 || null,
    creditLimit: card.creditLimit ? normalizeMoney(card.creditLimit) : null,
  });
  if (ok) cancelCardForm();
}
async function createPurchase() {
  const totalAmount = normalizeMoney(purchase.totalAmount);
  if (!totalAmount) {
    error.value = 'Informe um valor total válido, ex.: 150 ou 150,00.';
    return;
  }
  const ok = await mutate('/card-purchases', {
    ...purchase,
    totalAmount,
    notes: purchase.notes || null,
    installmentCount: Number(purchase.installmentCount),
  });
  if (ok) cancelPurchaseForm();
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
    return true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha na operação.';
    return false;
  } finally {
    saving.value = false;
  }
}
async function patch(path: string, body: object) {
  saving.value = true;
  error.value = '';
  try {
    await api(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    cancelCardEdit();
    cancelPurchaseEdit();
    await load();
    return true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha na edição.';
    return false;
  } finally {
    saving.value = false;
  }
}
function cardActionsFor(item: PublicFinancialCreditCard): KebabMenuAction[] {
  return [
    { label: 'Editar', onSelect: () => startCardEdit(item) },
    {
      label: item.archivedAt ? 'Restaurar' : 'Arquivar',
      danger: !item.archivedAt,
      onSelect: () => toggle(item),
    },
  ];
}
function purchaseActionsFor(item: (typeof purchases.value)[number]): KebabMenuAction[] {
  return [
    { label: 'Editar compra', onSelect: () => startPurchaseEdit(item) },
    {
      label: 'Excluir compra',
      danger: true,
      onSelect: () => openPurchaseDelete(item),
    },
  ];
}
function resetCardForm() {
  Object.assign(card, {
    name: '',
    issuer: '',
    last4: '',
    creditLimit: '',
    closingDay: 10,
    dueDay: 17,
  });
}
function resetPurchaseForm() {
  Object.assign(purchase, {
    cardId: contextualCardId.value || '',
    categoryId: '',
    description: '',
    notes: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    totalAmount: '',
    installmentCount: 1,
  });
}
function closeInlineFlows() {
  cancelCardEdit();
  cancelPurchaseEdit();
  cancelInvoicePayment();
}
function openCardForm() {
  closeInlineFlows();
  showPurchaseForm.value = false;
  showCardForm.value = true;
}
function cancelCardForm() {
  showCardForm.value = false;
  resetCardForm();
}
function openPurchaseForm() {
  closeInlineFlows();
  showCardForm.value = false;
  purchase.cardId = contextualCardId.value || purchase.cardId;
  showPurchaseForm.value = true;
}
function cancelPurchaseForm() {
  showPurchaseForm.value = false;
  resetPurchaseForm();
}
function cancelCardEdit() {
  editingCardId.value = '';
  Object.assign(editCard, {
    name: '',
    issuer: '',
    last4: '',
    creditLimit: '',
    closingDay: 1,
    dueDay: 1,
  });
}
function cancelPurchaseEdit() {
  editingPurchaseId.value = '';
  originalPurchase.value = null;
  Object.assign(editPurchase, {
    cardId: '',
    categoryId: '',
    description: '',
    notes: '',
    purchaseDate: '',
    totalAmount: '',
    installmentCount: 1,
  });
}
function startCardEdit(item: PublicFinancialCreditCard) {
  showCardForm.value = false;
  showPurchaseForm.value = false;
  cancelPurchaseEdit();
  cancelInvoicePayment();
  editingCardId.value = item.id;
  Object.assign(editCard, {
    name: item.name,
    issuer: item.issuer ?? '',
    last4: item.last4 ?? '',
    creditLimit: item.creditLimit ?? '',
    closingDay: item.closingDay,
    dueDay: item.dueDay,
  });
}
function saveCardEdit() {
  if (editCard.creditLimit && !normalizeMoney(editCard.creditLimit)) {
    error.value = 'Informe um limite válido, ex.: 5000 ou 5000,00.';
    return;
  }
  return patch(`/cards/${editingCardId.value}`, {
    ...editCard,
    issuer: editCard.issuer || null,
    last4: editCard.last4 || null,
    creditLimit: editCard.creditLimit ? normalizeMoney(editCard.creditLimit) : null,
  });
}
function startPurchaseEdit(item: (typeof purchases.value)[number]) {
  showCardForm.value = false;
  showPurchaseForm.value = false;
  cancelCardEdit();
  cancelInvoicePayment();
  editingPurchaseId.value = item.id;
  originalPurchase.value = item;
  Object.assign(editPurchase, {
    cardId: item.cardId,
    categoryId: item.categoryId,
    description: item.description,
    notes: item.notes ?? '',
    purchaseDate: item.purchaseDate,
    totalAmount: item.totalAmount,
    installmentCount: item.installmentCount,
  });
}
function savePurchaseEdit() {
  const original = originalPurchase.value;
  if (!original) return;

  const totalAmount = normalizeMoney(editPurchase.totalAmount);
  if (!totalAmount) {
    error.value = 'Informe um valor total válido, ex.: 150 ou 150,00.';
    return;
  }
  const delta: UpdateCardPurchaseRequest = {};
  const notes = editPurchase.notes || null;
  const installmentCount = Number(editPurchase.installmentCount);
  if (editPurchase.cardId !== original.cardId) delta.cardId = editPurchase.cardId;
  if (editPurchase.categoryId !== original.categoryId) delta.categoryId = editPurchase.categoryId;
  if (editPurchase.description !== original.description)
    delta.description = editPurchase.description;
  if (notes !== original.notes) delta.notes = notes;
  if (editPurchase.purchaseDate !== original.purchaseDate)
    delta.purchaseDate = editPurchase.purchaseDate;
  if (totalAmount !== normalizeMoney(original.totalAmount)) delta.totalAmount = totalAmount;
  if (installmentCount !== original.installmentCount) delta.installmentCount = installmentCount;

  if (!Object.keys(delta).length) {
    cancelPurchaseEdit();
    return;
  }
  return patch(`/card-purchases/${editingPurchaseId.value}`, delta);
}
async function toggle(item: PublicFinancialCreditCard) {
  await mutate(`/cards/${item.id}/${item.archivedAt ? 'restore' : 'archive'}`);
}
function startInvoicePayment(invoice: PublicCardInvoice) {
  closeInlineFlows();
  const data = payment[invoice.id] ?? {
    accountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  };
  payment[invoice.id] = data;
  payingInvoiceId.value = invoice.id;
}
function cancelInvoicePayment() {
  payingInvoiceId.value = '';
}
async function pay(invoice: PublicCardInvoice) {
  const data = payment[invoice.id] ?? {
    accountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  };
  payment[invoice.id] = data;
  const ok = await mutate(`/card-invoices/${invoice.id}/pay`, data);
  if (ok) cancelInvoicePayment();
}
function openPurchaseDelete(item: (typeof purchases.value)[number]) {
  closeInlineFlows();
  deletePurchaseError.value = '';
  deletingPurchase.value = item;
}
function cancelPurchaseDelete() {
  deletePurchaseError.value = '';
  deletingPurchase.value = null;
}
async function confirmPurchaseDelete() {
  if (!deletingPurchase.value || deletingPurchaseBusy.value) return;
  deletingPurchaseBusy.value = true;
  deletePurchaseError.value = '';
  const fallback = 'Não foi possível excluir a compra.';
  try {
    const response = await authenticatedFetch(`/card-purchases/${deletingPurchase.value.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(safeApiErrorMessage(body, fallback));
    }
    deletingPurchase.value = null;
    await load();
  } catch (e) {
    deletePurchaseError.value = e instanceof Error ? e.message : fallback;
  } finally {
    deletingPurchaseBusy.value = false;
  }
}
const money = (v: string | null) =>
  v
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    : '—';
function purchaseInstallmentSummary(item: (typeof purchases.value)[number]) {
  if (item.installmentCount <= 1) return 'À vista';
  const firstAmount = item.installments[0]?.amount;
  return firstAmount
    ? `${item.installmentCount}x de ${money(firstAmount)}`
    : `${item.installmentCount}x`;
}
function shortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace('.', '');
}
function purchaseMeta(item: (typeof purchases.value)[number]) {
  return [
    shortDate(item.purchaseDate),
    cardNameById.value.get(item.cardId) ?? 'Cartão não encontrado',
    purchaseInstallmentSummary(item),
  ].join(' · ');
}
function categoryFor(categoryId: string) {
  return categoryById.value.get(categoryId) ?? null;
}
const invoiceStatusLabel: Record<PublicCardInvoice['status'], string> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PAID: 'Paga',
};
function invoiceTitle(referenceMonth: string) {
  const [year, month] = referenceMonth.split('-').map(Number);
  if (!year || !month) return referenceMonth;
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function invoiceMeta(invoice: PublicCardInvoice) {
  const count = invoice.installments.length;
  return [
    cardNameById.value.get(invoice.cardId) ?? 'Cartão não encontrado',
    `vence ${shortDate(invoice.dueDate)}`,
    invoiceStatusLabel[invoice.status],
    count === 1 ? '1 parcela' : `${count} parcelas`,
  ].join(' · ');
}
function invoiceActionsFor(invoice: PublicCardInvoice): KebabMenuAction[] {
  if (invoice.status === 'OPEN')
    return [{ label: 'Fechar fatura', onSelect: () => mutate(`/card-invoices/${invoice.id}/close`) }];
  if (invoice.status === 'CLOSED')
    return [{ label: 'Pagar fatura', onSelect: () => startInvoicePayment(invoice) }];
  return [];
}
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
      ><div class="section-toolbar">
        <button type="button" @click="openCardForm">
          <span class="material-icons" aria-hidden="true">add</span>
          Novo cartão
        </button>
      </div>
      <section v-if="showCardForm" class="panel form-panel">
        <h2>Novo cartão</h2>
        <form @submit.prevent="createCard">
          <div class="grid">
            <label>Nome<input v-model="card.name" maxlength="120" required /></label
            ><label>Emissor<input v-model="card.issuer" maxlength="120" /></label
            ><label
              >Últimos 4 dígitos (opcional)<input
                v-model="card.last4"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{4}" /></label
            ><label
              >Limite informativo (opcional)<input
                v-model="card.creditLimit"
                inputmode="decimal"
                placeholder="5000 ou 5000,00" /></label
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
          <div class="actions">
            <button :disabled="saving">Cadastrar cartão</button>
            <button type="button" class="secondary" :disabled="saving" @click="cancelCardForm">
              Cancelar
            </button>
          </div>
        </form>
      </section>
      <section>
        <h2>Seus cartões</h2>
        <p v-if="!cards.length" class="empty">
          Nenhum cartão cadastrado. Use Novo cartão para cadastrar o primeiro.
        </p>
        <div class="tiles">
          <article v-for="item in cards" :key="item.id" :class="{ archived: item.archivedAt }">
            <div class="tile-row">
              <div class="tile-info">
                <h3>{{ item.name }}</h3>
                <p>
                  {{ item.issuer || 'Emissor não informado' }} ·
                  {{ item.last4 ? `•••• ${item.last4}` : 'Final não informado' }}
                </p>
                <p>Limite informativo: {{ money(item.creditLimit) }}</p>
                <p>Fecha dia {{ item.closingDay }} · vence dia {{ item.dueDay }}</p>
              </div>
              <KebabMenu :label="`Ações de ${item.name}`" :actions="cardActionsFor(item)" />
            </div>
            <form v-if="editingCardId === item.id" @submit.prevent="saveCardEdit">
              <div class="grid">
                <label>Nome<input v-model="editCard.name" maxlength="120" required /></label>
                <label>Emissor<input v-model="editCard.issuer" maxlength="120" /></label>
                <label
                  >Últimos 4 (opcional)<input
                    v-model="editCard.last4"
                    pattern="[0-9]{4}"
                    maxlength="4"
                /></label>
                <label
                  >Limite (opcional)<input
                    v-model="editCard.creditLimit"
                    inputmode="decimal"
                    placeholder="5000 ou 5000,00"
                /></label>
                <label
                  >Fechamento<input
                    v-model.number="editCard.closingDay"
                    type="number"
                    min="1"
                    max="31"
                    required
                /></label>
                <label
                  >Vencimento<input
                    v-model.number="editCard.dueDay"
                    type="number"
                    min="1"
                    max="31"
                    required
                /></label>
              </div>
              <p>
                Novos dias valem somente para compras e faturas futuras; ciclos já materializados
                não são recalculados.
              </p>
              <button :disabled="saving">Salvar edição</button>
              <button type="button" class="secondary" @click="cancelCardEdit">Cancelar</button>
            </form>
          </article>
        </div>
      </section>
      <div class="section-toolbar">
        <button type="button" @click="openPurchaseForm">
          <span class="material-icons" aria-hidden="true">add</span>
          Nova compra
        </button>
      </div>
      <section v-if="showPurchaseForm" class="panel form-panel">
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
                inputmode="decimal"
                placeholder="150 ou 150,00"
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
          <div class="actions">
            <button :disabled="saving">Lançar compra</button>
            <button type="button" class="secondary" :disabled="saving" @click="cancelPurchaseForm">
              Cancelar
            </button>
          </div>
        </form>
      </section>
      <section>
        <h2>Compras e parcelas futuras</h2>
        <p v-if="!purchases.length" class="empty">Nenhuma compra no cartão.</p>
        <article
          v-for="x in purchases"
          :key="x.id"
          class="purchase-card"
        >
          <div class="purchase-card__summary">
            <div class="purchase-card__main">
              <div class="purchase-card__title">
                <CategoryIcon
                  v-if="categoryFor(x.categoryId)"
                  :icon="categoryFor(x.categoryId)?.icon"
                  :color="categoryFor(x.categoryId)?.color"
                  :label="categoryFor(x.categoryId)?.name"
                />
                <h3>{{ x.description }}</h3>
              </div>
              <strong>{{ money(x.totalAmount) }}</strong>
            </div>
            <p>{{ purchaseMeta(x) }}</p>
          </div>
          <KebabMenu
            :label="`Ações da compra ${x.description}`"
            :actions="purchaseActionsFor(x)"
            @click.stop
          />
          <form v-if="editingPurchaseId === x.id" @submit.prevent="savePurchaseEdit">
            <div class="grid">
              <label
                >Cartão<select v-model="editPurchase.cardId" required>
                  <option v-for="c in editablePurchaseCards" :key="c.id" :value="c.id">
                    {{ c.name }}{{ c.archivedAt ? ' (arquivado)' : '' }}
                  </option>
                </select></label
              >
              <label
                >Categoria<select v-model="editPurchase.categoryId" required>
                  <option v-for="c in expenseCategories" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </option>
                </select></label
              >
              <label
                >Descrição<input v-model="editPurchase.description" maxlength="200" required
              /></label>
              <label>Data<input v-model="editPurchase.purchaseDate" type="date" required /></label>
              <label
                >Valor<input v-model="editPurchase.totalAmount" inputmode="decimal" required
              /></label>
              <label
                >Parcelas<input
                  v-model.number="editPurchase.installmentCount"
                  type="number"
                  min="1"
                  max="36"
                  required
              /></label>
              <label class="wide"
                >Notas<textarea v-model="editPurchase.notes" maxlength="2000" />
              </label>
            </div>
            <p>A edição só é concluída enquanto todas as faturas relacionadas estiverem abertas.</p>
            <button :disabled="saving">Salvar compra</button>
            <button type="button" class="secondary" @click="cancelPurchaseEdit">
              Cancelar
            </button>
          </form>
        </article>
        <button v-if="purchaseCursor" :disabled="loadingPurchases" @click="loadMore('purchases')">
          {{ loadingPurchases ? 'Carregando…' : 'Carregar mais compras' }}
        </button>
      </section>
      <section>
        <h2>Faturas</h2>
        <p v-if="!invoices.length" class="empty">Nenhuma fatura materializada.</p>
        <article v-for="x in invoices" :key="x.id" class="invoice-card">
          <div class="invoice-card__summary">
            <div class="invoice-card__main">
              <h3>{{ invoiceTitle(x.referenceMonth) }}</h3>
              <strong>{{ money(x.total) }}</strong>
            </div>
            <p>{{ invoiceMeta(x) }}</p>
          </div>
          <KebabMenu
            v-if="invoiceActionsFor(x).length"
            :label="`Ações da fatura ${invoiceTitle(x.referenceMonth)}`"
            :actions="invoiceActionsFor(x)"
          />
          <div v-if="payingInvoiceId === x.id" class="pay">
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
                  {{ a.name }} ·
                  {{
                    a.realizedBalance === null
                      ? 'saldo atual indisponível'
                      : `saldo ${money(a.realizedBalance)}`
                  }}
                </option>
              </select></label
            ><label>Data<input v-model="payment[x.id]!.paymentDate" type="date" /></label>
            <div class="actions">
              <button :disabled="!payment[x.id]?.accountId" @click="pay(x)">
                Pagar integralmente
              </button>
              <button type="button" class="secondary" @click="cancelInvoicePayment">
                Cancelar
              </button>
            </div>
          </div>
          <p v-if="x.status === 'PAID'" class="invoice-note">
            Paga em {{ x.payment?.paymentDate }} pela conta selecionada.
          </p>
        </article>
        <button v-if="invoiceCursor" :disabled="loadingInvoices" @click="loadMore('invoices')">
          {{ loadingInvoices ? 'Carregando…' : 'Carregar mais faturas' }}
        </button>
      </section></template
    >
    <ConfirmDialog
      :open="!!deletingPurchase"
      :title="`Excluir a compra ${deletingPurchase?.description ?? ''}?`"
      :message="
        deletePurchaseError ||
        'Isso remove a compra e todas as suas parcelas das faturas abertas.'
      "
      confirm-label="Excluir"
      :busy="deletingPurchaseBusy"
      @confirm="confirmPurchaseDelete"
      @cancel="cancelPurchaseDelete"
    />
  </main>
</template>
<style scoped>
.cards-page {
  width: min(100%, 75rem);
  padding: 1rem;
}
.section-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: 1rem 0 0.5rem;
}
.section-toolbar button,
.actions button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.panel,
article,
.empty {
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin: 1rem 0;
  box-shadow: var(--shadow-surface);
}
.form-panel {
  margin-top: 0.5rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.85rem;
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
.tile-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.tile-info p {
  margin: 0.15rem 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.tile-info h3 {
  margin: 0;
}
.purchase-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
}
.purchase-card form {
  flex-basis: 100%;
  cursor: auto;
}
.purchase-card__summary {
  min-width: 0;
  flex: 1;
}
.purchase-card__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
.purchase-card__title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.purchase-card__title :deep(.category-icon) {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 0.4rem;
}
.purchase-card__title :deep(.material-icons) {
  font-size: 0.95rem;
}
.purchase-card__main h3,
.purchase-card__summary p {
  margin: 0;
}
.purchase-card__main h3 {
  min-width: 0;
  font-size: 1rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.purchase-card__main strong {
  white-space: nowrap;
}
.purchase-card__summary p {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}
.invoice-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
}
.invoice-card__summary {
  min-width: 0;
  flex: 1;
}
.invoice-card__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
.invoice-card__main h3,
.invoice-card__summary p,
.invoice-note {
  margin: 0;
}
.invoice-card__main h3 {
  min-width: 0;
  font-size: 1rem;
  line-height: 1.25;
}
.invoice-card__main strong {
  white-space: nowrap;
}
.invoice-card__summary p,
.invoice-note {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}
.invoice-card .pay {
  flex-basis: 100%;
}
.badge {
  font-weight: 700;
  color: var(--color-accent);
}
.secondary,
.link {
  background: var(--color-accent-container);
  color: var(--color-on-accent-container);
}
.pay {
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  padding-top: 1rem;
}
select,
textarea {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  width: 100%;
  background: var(--color-surface);
  color: var(--color-text);
}
@media (max-width: 600px) {
  .cards-page {
    padding: 0.5rem;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .purchase-card {
    padding: 0.75rem;
  }
  .purchase-card,
  .purchase-card__main,
  .invoice-card,
  .invoice-card__main {
    align-items: stretch;
  }
  .purchase-card__main,
  .invoice-card__main {
    flex-direction: column;
    gap: 0.15rem;
  }
}
</style>
