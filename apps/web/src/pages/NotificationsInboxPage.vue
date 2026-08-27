<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../components/PageHeader.vue';
import type {
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicFinancialCreditCard,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { catalogLabelFor } from '../notification-app-catalog';
import { visibleNotificationTexts } from '../notification-content';
import { notificationsApi } from '../notifications-api';

const STATUS_LABELS: Record<string, string> = {
  UNCLASSIFIED: 'Não classificada',
  FINANCIAL_CANDIDATE: 'Possível movimentação',
  NON_FINANCIAL: 'Não financeira',
  AMBIGUOUS: 'Precisa de revisão',
  IGNORED: 'Ignorada',
  DISMISSED: 'Descartada',
  CONFIRMED: 'Confirmada',
};

const route = useRoute();
const router = useRouter();

const items = ref<Awaited<ReturnType<typeof notificationsApi.list>>['data']>([]);
const loading = ref(true);
const error = ref('');

const detail = ref<Awaited<ReturnType<typeof notificationsApi.get>> | null>(null);
const detailLoading = ref(false);
const detailError = ref('');
const actionError = ref('');
const actionFeedback = ref('');
const submitting = ref(false);

const accounts = ref<PublicFinancialAccount[]>([]);
const categories = ref<PublicFinancialCategory[]>([]);
const cards = ref<PublicFinancialCreditCard[]>([]);

const id = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));
const showingDismissed = computed(() => route.query.status === 'DISMISSED');
const pageTitle = computed(() => (showingDismissed.value ? 'Descartadas' : 'Para revisar'));
const detailBackTo = computed(() =>
  showingDismissed.value ? '/notifications/inbox?status=DISMISSED' : '/notifications/inbox',
);
const originalTexts = computed(() =>
  detail.value ? visibleNotificationTexts(detail.value.text, detail.value.bigText) : [],
);

const form = reactive({
  type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
  amount: '',
  description: '',
  date: '',
  accountId: '',
  cardId: '',
  installmentCount: 1,
  categoryId: '',
});

function appLabel(packageName: string) {
  return catalogLabelFor(packageName) ?? packageName;
}

/** new Date(iso) getters read the runtime's local timezone; toISOString() would revert to UTC. */
function toLocalDateInputValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    const response = await notificationsApi.list(showingDismissed.value ? 'DISMISSED' : undefined);
    items.value = response.data;
  } catch {
    error.value = 'Não foi possível carregar as notificações agora.';
  } finally {
    loading.value = false;
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(path);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(safeApiErrorMessage(body, 'Não foi possível carregar os dados do formulário.'));
  return body as T;
}

async function loadDetail(notificationId: string) {
  detailLoading.value = true;
  detailError.value = '';
  actionError.value = '';
  actionFeedback.value = '';
  try {
    const [notification, accountList, categoryList, cardList] = await Promise.all([
      notificationsApi.get(notificationId),
      accounts.value.length
        ? Promise.resolve(accounts.value)
        : fetchJson<PublicFinancialAccount[]>('/accounts'),
      categories.value.length
        ? Promise.resolve(categories.value)
        : fetchJson<PublicFinancialCategory[]>('/categories'),
      cards.value.length
        ? Promise.resolve(cards.value)
        : fetchJson<{ items: PublicFinancialCreditCard[] }>('/cards').then(
            (response) => response.items,
          ),
    ]);
    detail.value = notification;
    accounts.value = accountList;
    categories.value = categoryList;
    cards.value = cardList;
    form.type = notification.parsedType ?? 'EXPENSE';
    form.amount = notification.parsedAmount ?? '';
    form.description = notification.parsedDescription ?? '';
    form.date = toLocalDateInputValue(notification.postedAt);
    form.accountId = notification.accountId ?? '';
    form.cardId = notification.cardId ?? '';
    form.installmentCount = 1;
    form.categoryId = notification.categoryId ?? '';
    if (
      !form.accountId &&
      !form.cardId &&
      form.type === 'EXPENSE' &&
      notification.parsedCardLast4
    ) {
      const matches = cardList.filter(
        (candidate) => !candidate.archivedAt && candidate.last4 === notification.parsedCardLast4,
      );
      if (matches.length === 1) form.cardId = matches[0]!.id;
    }
  } catch {
    detailError.value = 'Não foi possível carregar esta notificação agora.';
  } finally {
    detailLoading.value = false;
  }
}

watch(
  () => [id.value, route.query.status] as const,
  ([value]) => {
    if (value) {
      void loadDetail(value);
    } else {
      detail.value = null;
      void loadList();
    }
  },
  { immediate: true },
);

const activeAccounts = computed(() => accounts.value.filter((account) => !account.archivedAt));
const activeCards = computed(() => cards.value.filter((card) => !card.archivedAt));
const isCardPayment = computed(() => form.type === 'EXPENSE' && !!form.cardId);
const paymentMethod = computed({
  get: () =>
    form.cardId ? `card:${form.cardId}` : form.accountId ? `account:${form.accountId}` : '',
  set: (value: string) => {
    if (value.startsWith('card:')) {
      form.cardId = value.slice('card:'.length);
      form.accountId = '';
      return;
    }
    if (value.startsWith('account:')) {
      form.accountId = value.slice('account:'.length);
      form.cardId = '';
      return;
    }
    form.accountId = '';
    form.cardId = '';
  },
});
const compatibleCategories = computed(() =>
  categories.value.filter((category) => !category.archivedAt && category.type === form.type),
);
const canConfirm = computed(
  () =>
    (form.type === 'EXPENSE'
      ? !!form.accountId || !!form.cardId
      : !!form.accountId && !form.cardId) &&
    !!form.categoryId &&
    (!isCardPayment.value ||
      (Number.isInteger(form.installmentCount) &&
        form.installmentCount >= 1 &&
        form.installmentCount <= 36)) &&
    /^(0|[1-9][0-9]{0,16})\.[0-9]{1,2}$/.test(form.amount) &&
    !!form.date &&
    !!form.description.trim() &&
    detail.value?.status !== 'CONFIRMED' &&
    detail.value?.status !== 'DISMISSED',
);

async function confirm() {
  if (!id.value || !canConfirm.value) return;
  submitting.value = true;
  actionError.value = '';
  try {
    detail.value = await notificationsApi.confirm(id.value, {
      paymentSourceType: isCardPayment.value ? 'CARD' : 'ACCOUNT',
      ...(isCardPayment.value
        ? { cardId: form.cardId, installmentCount: Number(form.installmentCount) }
        : { accountId: form.accountId }),
      categoryId: form.categoryId,
      type: form.type,
      amount: form.amount,
      description: form.description.trim(),
      date: form.date,
    });
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Não foi possível confirmar.';
  } finally {
    submitting.value = false;
  }
}

async function dismiss() {
  if (!id.value) return;
  submitting.value = true;
  actionError.value = '';
  try {
    detail.value = await notificationsApi.dismiss(id.value);
    actionFeedback.value = 'Notificação descartada.';
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Não foi possível descartar.';
  } finally {
    submitting.value = false;
  }
}

async function restore() {
  if (!id.value) return;
  submitting.value = true;
  actionError.value = '';
  try {
    detail.value = await notificationsApi.restore(id.value);
    actionFeedback.value = 'Notificação restaurada para revisão.';
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Não foi possível restaurar.';
  } finally {
    submitting.value = false;
  }
}

async function deleteDismissed() {
  if (!id.value) return;
  if (!globalThis.confirm('Excluir definitivamente esta notificação descartada?')) return;
  submitting.value = true;
  actionError.value = '';
  try {
    await notificationsApi.deleteDismissed(id.value);
    detail.value = null;
    actionFeedback.value = 'Notificação excluída definitivamente.';
    await router.push('/notifications/inbox?status=DISMISSED');
  } catch (reason) {
    actionError.value =
      reason instanceof Error ? reason.message : 'Não foi possível excluir definitivamente.';
  } finally {
    submitting.value = false;
  }
}

async function markNonFinancial() {
  if (!id.value) return;
  submitting.value = true;
  actionError.value = '';
  try {
    detail.value = await notificationsApi.markNonFinancial(id.value);
  } catch (reason) {
    actionError.value =
      reason instanceof Error ? reason.message : 'Não foi possível marcar como não financeira.';
  } finally {
    submitting.value = false;
  }
}

watch(
  () => form.type,
  () => {
    if (form.type === 'INCOME') form.cardId = '';
    if (!compatibleCategories.value.some((category) => category.id === form.categoryId))
      form.categoryId = '';
  },
);
</script>

<template>
  <main class="inbox-page">
    <PageHeader :title="pageTitle" :back-to="id ? detailBackTo : '/notifications'" />
    <p v-if="actionFeedback" class="action-feedback" role="status">
      {{ actionFeedback }}
      <button
        v-if="detail?.status === 'DISMISSED'"
        type="button"
        class="link-button"
        :disabled="submitting"
        @click="restore"
      >
        Desfazer
      </button>
    </p>

    <template v-if="!id">
      <nav class="inbox-tabs" aria-label="Filtro de notificações capturadas">
        <router-link
          to="/notifications/inbox"
          :aria-current="!showingDismissed ? 'page' : undefined"
        >
          Para revisar
        </router-link>
        <router-link
          to="/notifications/inbox?status=DISMISSED"
          :aria-current="showingDismissed ? 'page' : undefined"
        >
          Descartadas
        </router-link>
      </nav>
      <p v-if="error" role="alert">
        {{ error }} <button class="link-button" @click="loadList">Tentar novamente</button>
      </p>
      <p v-if="loading" aria-live="polite">Carregando…</p>
      <section v-else-if="items.length === 0" class="empty panel">
        <h2>
          {{
            showingDismissed ? 'Nenhuma notificação descartada' : 'Nenhuma notificação para revisar'
          }}
        </h2>
        <p v-if="!showingDismissed">
          Quando o PlannerFin capturar notificações de apps monitorados, elas aparecerão aqui para
          você revisar antes de virarem um lançamento.
        </p>
        <p v-else>As capturas descartadas continuam recuperáveis até o prazo de retenção.</p>
      </section>
      <ul v-else class="notification-list">
        <li v-for="item in items" :key="item.id">
          <router-link
            :to="{
              path: `/notifications/inbox/${item.id}`,
              query: showingDismissed ? { status: 'DISMISSED' } : {},
            }"
            class="notification-card"
          >
            <div class="card-top">
              <strong>{{ appLabel(item.packageName) }}</strong>
              <span class="badge" :data-status="item.status">{{ STATUS_LABELS[item.status] }}</span>
            </div>
            <p class="card-description">
              {{ item.parsedDescription || item.title || 'Sem descrição' }}
            </p>
            <div class="card-bottom">
              <span v-if="item.parsedAmount"
                >{{ item.parsedType === 'INCOME' ? '+' : '-' }} R$ {{ item.parsedAmount }}</span
              >
              <time>{{ new Date(item.postedAt).toLocaleString('pt-BR') }}</time>
            </div>
          </router-link>
        </li>
      </ul>
    </template>

    <template v-else>
      <p v-if="detailError" role="alert">{{ detailError }}</p>
      <p v-if="detailLoading" aria-live="polite">Carregando…</p>
      <template v-else-if="detail">
        <section class="panel">
          <h2>Notificação original (minimizada)</h2>
          <p class="app-line">
            {{ appLabel(detail.packageName) }} ·
            {{ new Date(detail.postedAt).toLocaleString('pt-BR') }}
          </p>
          <blockquote class="original">
            <strong v-if="detail.title">{{ detail.title }}</strong>
            <p v-for="content in originalTexts" :key="content">{{ content }}</p>
            <p v-if="detail.subText">{{ detail.subText }}</p>
            <p v-if="!detail.title && !detail.text && !detail.subText && !detail.bigText">
              Sem conteúdo legível.
            </p>
          </blockquote>
        </section>

        <section class="panel">
          <h2>Interpretação sugerida</h2>
          <p>
            <span class="badge" :data-status="detail.status">{{
              STATUS_LABELS[detail.status]
            }}</span>
          </p>
          <p v-if="detail.classificationReasons.length" class="fine-print">
            Motivos: {{ detail.classificationReasons.join(', ') }}
          </p>

          <p v-if="actionError" role="alert">{{ actionError }}</p>
          <template v-if="detail.status === 'CONFIRMED'">
            <p role="status">Esta notificação já foi confirmada em um lançamento.</p>
          </template>
          <template v-else-if="detail.status === 'DISMISSED'">
            <p>Esta captura foi removida da fila de revisão, mas ainda pode ser restaurada.</p>
            <div class="dismissed-actions">
              <button type="button" class="primary" :disabled="submitting" @click="restore">
                Restaurar para revisar
              </button>
              <button type="button" class="danger" :disabled="submitting" @click="deleteDismissed">
                Excluir definitivamente
              </button>
            </div>
          </template>
          <template v-else>
            <form class="review-form" @submit.prevent="confirm">
              <label>
                Tipo
                <select v-model="form.type">
                  <option value="EXPENSE">Saída</option>
                  <option value="INCOME">Entrada</option>
                </select>
              </label>
              <label>
                Valor
                <input v-model="form.amount" inputmode="decimal" placeholder="0.00" />
              </label>
              <label>
                Descrição
                <input v-model="form.description" maxlength="200" />
              </label>
              <label>
                Data
                <input v-model="form.date" type="date" />
              </label>
              <label v-if="form.type === 'EXPENSE'">
                Pago com
                <select v-model="paymentMethod">
                  <option value="" disabled>Selecione</option>
                  <optgroup label="Contas">
                    <option
                      v-for="account in activeAccounts"
                      :key="account.id"
                      :value="`account:${account.id}`"
                    >
                      {{ account.name }}
                    </option>
                  </optgroup>
                  <optgroup v-if="activeCards.length" label="Cartões de crédito">
                    <option v-for="card in activeCards" :key="card.id" :value="`card:${card.id}`">
                      {{ card.name }}{{ card.last4 ? ` •••• ${card.last4}` : '' }}
                    </option>
                  </optgroup>
                </select>
              </label>
              <label v-else>
                Conta
                <select v-model="form.accountId">
                  <option value="" disabled>Selecione</option>
                  <option v-for="account in activeAccounts" :key="account.id" :value="account.id">
                    {{ account.name }}
                  </option>
                </select>
              </label>
              <label v-if="isCardPayment">
                Parcelas
                <input v-model.number="form.installmentCount" type="number" min="1" max="36" />
              </label>
              <label>
                Categoria
                <select v-model="form.categoryId">
                  <option value="" disabled>Selecione</option>
                  <option
                    v-for="category in compatibleCategories"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.name }}
                  </option>
                </select>
              </label>

              <div class="actions">
                <button type="submit" class="primary" :disabled="!canConfirm || submitting">
                  Confirmar lançamento
                </button>
                <div class="secondary-actions">
                  <div class="explained-action">
                    <button type="button" class="secondary" :disabled="submitting" @click="dismiss">
                      Descartar esta captura
                    </button>
                    <p>Remove da fila de revisão. Você poderá restaurá-la depois.</p>
                  </div>
                  <div class="explained-action">
                    <button
                      type="button"
                      class="secondary"
                      :disabled="submitting"
                      @click="markNonFinancial"
                    >
                      Não é movimentação financeira
                    </button>
                    <p>Promoção, aviso, limite ou mensagem informativa.</p>
                  </div>
                </div>
              </div>
            </form>
          </template>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.inbox-page {
  width: min(100%, 42rem);
  margin: 0 auto;
}
.panel {
  margin-top: 0.75rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
}
.empty p {
  color: var(--color-text-muted);
}
.inbox-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.inbox-tabs a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  text-decoration: none;
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  background: var(--color-surface);
}
.inbox-tabs a[aria-current='page'] {
  color: var(--color-on-accent-container);
  border-color: var(--color-accent);
  background: var(--color-accent-container);
}
.notification-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}
.notification-card {
  display: block;
  padding: 0.85rem;
  color: var(--color-text);
  text-decoration: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.card-description {
  margin: 0.35rem 0;
  color: var(--color-text-muted);
}
.card-bottom {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.badge {
  color: var(--color-text-muted);
  background: var(--color-border);
  padding: 0.2rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.8rem;
}
.badge[data-status='FINANCIAL_CANDIDATE'] {
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
}
.badge[data-status='CONFIRMED'] {
  color: var(--color-on-accent);
  background: var(--color-accent);
}
.app-line {
  margin: 0 0 0.5rem;
  color: var(--color-text-muted);
}
.original {
  margin: 0;
  padding: 0.75rem;
  background: var(--color-background);
  border-left: 3px solid var(--color-border);
  color: var(--color-text-muted);
}
.original p {
  margin: 0.25rem 0;
}
.fine-print {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.review-form {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.5rem;
}
.review-form label {
  display: grid;
  gap: 0.25rem;
}
.review-form input,
.review-form select {
  min-height: 2.75rem;
  padding: 0 0.65rem;
  border-radius: 0.45rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.actions .primary {
  width: 100%;
  font-weight: 700;
}
.secondary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.explained-action {
  display: grid;
  align-content: start;
  gap: 0.35rem;
}
.explained-action button {
  width: 100%;
}
.explained-action p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.dismissed-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.danger {
  color: var(--color-error);
  background: var(--color-error-container);
  border-color: var(--color-error-border);
}
.action-feedback {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem;
  border-radius: 0.45rem;
  background: var(--color-accent-container);
  color: var(--color-on-accent-container);
}
button,
.link-button {
  min-height: 2.75rem;
  padding: 0 1rem;
  border-radius: 0.45rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.primary {
  color: var(--color-on-accent);
  background: var(--color-accent);
  border-color: var(--color-accent);
}
button:disabled {
  opacity: 0.6;
}
button:focus-visible,
.link-button:focus-visible,
.inbox-tabs a:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

@media (max-width: 30rem) {
  .secondary-actions {
    grid-template-columns: 1fr;
  }
}
</style>
