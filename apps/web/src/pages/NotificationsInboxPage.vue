<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { PublicFinancialAccount, PublicFinancialCategory } from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { safeApiErrorMessage } from '../api-error';
import { catalogLabelFor } from '../notification-app-catalog';
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
const submitting = ref(false);

const accounts = ref<PublicFinancialAccount[]>([]);
const categories = ref<PublicFinancialCategory[]>([]);

const id = computed(() => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id));

const form = reactive({
  type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
  amount: '',
  description: '',
  date: '',
  accountId: '',
  categoryId: '',
});

function appLabel(packageName: string) {
  return catalogLabelFor(packageName) ?? packageName;
}

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    const response = await notificationsApi.list();
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
  try {
    const [notification, accountList, categoryList] = await Promise.all([
      notificationsApi.get(notificationId),
      accounts.value.length
        ? Promise.resolve(accounts.value)
        : fetchJson<PublicFinancialAccount[]>('/accounts'),
      categories.value.length
        ? Promise.resolve(categories.value)
        : fetchJson<PublicFinancialCategory[]>('/categories'),
    ]);
    detail.value = notification;
    accounts.value = accountList;
    categories.value = categoryList;
    form.type = notification.parsedType ?? 'EXPENSE';
    form.amount = notification.parsedAmount ?? '';
    form.description = notification.parsedDescription ?? '';
    form.date = notification.postedAt.slice(0, 10);
    form.accountId = notification.accountId ?? '';
    form.categoryId = notification.categoryId ?? '';
  } catch {
    detailError.value = 'Não foi possível carregar esta notificação agora.';
  } finally {
    detailLoading.value = false;
  }
}

watch(
  id,
  (value) => {
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
const compatibleCategories = computed(() =>
  categories.value.filter((category) => !category.archivedAt && category.type === form.type),
);
const canConfirm = computed(
  () =>
    !!form.accountId &&
    !!form.categoryId &&
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
      accountId: form.accountId,
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
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Não foi possível descartar.';
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

function backToList() {
  router.push('/notifications/inbox');
}
</script>

<template>
  <main class="inbox-page">
    <header>
      <h1>Para revisar</h1>
    </header>

    <template v-if="!id">
      <p v-if="error" role="alert">
        {{ error }} <button class="link-button" @click="loadList">Tentar novamente</button>
      </p>
      <p v-if="loading" aria-live="polite">Carregando…</p>
      <section v-else-if="items.length === 0" class="empty panel">
        <h2>Nenhuma notificação para revisar</h2>
        <p>
          Quando o PlannerFin capturar notificações de apps monitorados, elas aparecerão aqui para
          você revisar antes de virarem um lançamento.
        </p>
      </section>
      <ul v-else class="notification-list">
        <li v-for="item in items" :key="item.id">
          <router-link :to="`/notifications/inbox/${item.id}`" class="notification-card">
            <div class="card-top">
              <strong>{{ appLabel(item.packageName) }}</strong>
              <span class="badge" :data-status="item.status">{{ STATUS_LABELS[item.status] }}</span>
            </div>
            <p class="card-description">{{ item.parsedDescription || item.title || 'Sem descrição' }}</p>
            <div class="card-bottom">
              <span v-if="item.parsedAmount">{{
                item.parsedType === 'INCOME' ? '+' : '-'
              }}
                R$ {{ item.parsedAmount }}</span>
              <time>{{ new Date(item.postedAt).toLocaleString('pt-BR') }}</time>
            </div>
          </router-link>
        </li>
      </ul>
    </template>

    <template v-else>
      <button class="link-button back" @click="backToList">← Voltar</button>
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
            <p v-if="detail.text">{{ detail.text }}</p>
            <p v-if="detail.subText">{{ detail.subText }}</p>
            <p v-if="detail.bigText">{{ detail.bigText }}</p>
            <p v-if="!detail.title && !detail.text && !detail.subText && !detail.bigText">
              Sem conteúdo legível.
            </p>
          </blockquote>
        </section>

        <section class="panel">
          <h2>Interpretação sugerida</h2>
          <p>
            <span class="badge" :data-status="detail.status">{{ STATUS_LABELS[detail.status] }}</span>
          </p>
          <p v-if="detail.classificationReasons.length" class="fine-print">
            Motivos: {{ detail.classificationReasons.join(', ') }}
          </p>

          <p v-if="actionError" role="alert">{{ actionError }}</p>

          <template v-if="detail.status === 'CONFIRMED'">
            <p role="status">Esta notificação já foi confirmada em um lançamento.</p>
          </template>
          <template v-else-if="detail.status === 'DISMISSED'">
            <p role="status">Esta notificação foi descartada.</p>
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
              <label>
                Conta
                <select v-model="form.accountId">
                  <option value="" disabled>Selecione</option>
                  <option v-for="account in activeAccounts" :key="account.id" :value="account.id">
                    {{ account.name }}
                  </option>
                </select>
              </label>
              <label>
                Categoria
                <select v-model="form.categoryId">
                  <option value="" disabled>Selecione</option>
                  <option v-for="category in compatibleCategories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </label>

              <div class="actions">
                <button type="submit" class="primary" :disabled="!canConfirm || submitting">
                  Confirmar
                </button>
                <button type="button" class="secondary" :disabled="submitting" @click="dismiss">
                  Descartar
                </button>
                <button type="button" class="secondary" :disabled="submitting" @click="markNonFinancial">
                  Marcar como não financeira
                </button>
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
.back {
  margin-top: 0.5rem;
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
  flex-wrap: wrap;
  gap: 0.5rem;
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
.link-button:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
