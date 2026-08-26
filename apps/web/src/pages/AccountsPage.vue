<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type {
  CreateFinancialAccountRequest,
  FinancialAccountType,
  PublicFinancialAccount,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import KebabMenu, { type KebabMenuAction } from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import PageHeader from '../components/PageHeader.vue';
import { normalizeMoney } from '../transaction-template';

const accounts = ref<PublicFinancialAccount[]>([]);
const loading = ref(false);
const error = ref('');
const includeArchived = ref(false);
const editingId = ref<string | null>(null);
const archiving = ref<PublicFinancialAccount | null>(null);
const archivingBusy = ref(false);
const showForm = ref(false);
const initial = (): CreateFinancialAccountRequest => ({
  name: '',
  type: 'CHECKING',
  institution: null,
  currency: 'BRL',
  openingBalance: '0.00',
  openingBalanceDate: new Date().toISOString().slice(0, 10),
});
const form = reactive(initial());
const labels: Record<FinancialAccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  CASH: 'Carteira / dinheiro',
  PAYMENT: 'Conta digital / pagamento',
  OTHER: 'Outros',
};

async function api(
  path: string,
  init?: Parameters<typeof authenticatedFetch>[1],
): Promise<unknown> {
  let response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? 'Não foi possível concluir a operação.');
  return data;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    accounts.value = (await api(
      `/accounts${includeArchived.value ? '?includeArchived=true' : ''}`,
    )) as PublicFinancialAccount[];
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  Object.assign(form, initial());
  editingId.value = null;
  showForm.value = true;
}
function openEdit(account: PublicFinancialAccount) {
  Object.assign(form, {
    name: account.name,
    type: account.type,
    institution: account.institution,
    currency: 'BRL',
    openingBalance: account.openingBalance,
    openingBalanceDate: account.openingBalanceDate,
  });
  editingId.value = account.id;
  showForm.value = true;
}
function valid(): boolean {
  return (
    form.name.trim().length > 0 &&
    form.name.trim().length <= 120 &&
    normalizeMoney(form.openingBalance, { allowNegative: true, allowZero: true }) !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.openingBalanceDate) &&
    (!form.institution || form.institution.trim().length <= 120)
  );
}
async function save() {
  if (!valid()) {
    error.value = 'Revise nome, instituição, saldo e data informados.';
    return;
  }
  loading.value = true;
  error.value = '';
  const payload = {
    ...form,
    name: form.name.trim(),
    institution: form.institution?.trim() || null,
    openingBalance: normalizeMoney(form.openingBalance, {
      allowNegative: true,
      allowZero: true,
    })!,
  };
  try {
    await api(editingId.value ? `/accounts/${editingId.value}` : '/accounts', {
      method: editingId.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showForm.value = false;
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
async function confirmArchive() {
  if (!archiving.value || archivingBusy.value) return;
  archivingBusy.value = true;
  try {
    await action(archiving.value.id, 'archive');
    archiving.value = null;
  } finally {
    archivingBusy.value = false;
  }
}
function actionsFor(account: PublicFinancialAccount): KebabMenuAction[] {
  if (account.archivedAt)
    return [{ label: 'Reativar', onSelect: () => action(account.id, 'restore') }];
  return [
    { label: 'Editar', onSelect: () => openEdit(account) },
    { label: 'Arquivar', danger: true, onSelect: () => (archiving.value = account) },
  ];
}
async function action(id: string, operation: 'archive' | 'restore') {
  loading.value = true;
  error.value = '';
  try {
    await api(`/accounts/${id}/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
const money = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
onMounted(load);
</script>

<template>
  <main class="accounts-page">
    <PageHeader
      title="Contas financeiras"
      description="Organize suas posições iniciais com segurança."
      back-to="/mais"
    >
      <template #action><button @click="openCreate">Nova conta</button></template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }} <button class="link-button" @click="load">Tentar novamente</button>
    </p>
    <label class="filter"
      ><input v-model="includeArchived" type="checkbox" @change="load" /> Incluir contas
      arquivadas</label
    >
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="accounts.length === 0" class="empty">
      <h2>Nenhuma conta cadastrada</h2>
      <p>Cadastre uma conta para registrar sua posição inicial.</p>
      <button @click="openCreate">Criar primeira conta</button>
    </section>
    <section v-else class="account-grid">
      <article
        v-for="account in accounts"
        :key="account.id"
        class="account-card"
        :class="{ 'account-card--archived': account.archivedAt }"
      >
        <button type="button" class="entry-tap" @click="openEdit(account)">
          <span class="entry-top">
            <h2>
              {{ account.name }}<span v-if="account.archivedAt" class="badge">Arquivada</span>
            </h2>
            <span class="entry-amount">{{
              account.realizedBalance === null
                ? 'Saldo indisponível'
                : money(account.realizedBalance)
            }}</span>
          </span>
          <span class="entry-meta">
            {{ labels[account.type]
            }}<span v-if="account.institution"> · {{ account.institution }}</span>
          </span>
        </button>
        <KebabMenu :label="`Ações de ${account.name}`" :actions="actionsFor(account)" />
      </article>
    </section>
    <div v-if="showForm" class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <form class="account-form" @submit.prevent="save">
        <h2 id="form-title">{{ editingId ? 'Editar conta' : 'Nova conta' }}</h2>
        <label>Nome<input v-model="form.name" required maxlength="120" /></label
        ><label
          >Tipo<select v-model="form.type">
            <option v-for="(label, type) in labels" :key="type" :value="type">{{ label }}</option>
          </select></label
        ><label>Instituição (opcional)<input v-model="form.institution" maxlength="120" /></label
        ><label>Moeda<input value="BRL" disabled /></label
        ><label
          >Saldo inicial<input v-model="form.openingBalance" inputmode="decimal" required /></label
        ><label
          >Data de referência<input v-model="form.openingBalanceDate" type="date" required
        /></label>
        <div class="actions">
          <button type="button" class="secondary" @click="showForm = false">Cancelar</button
          ><button :disabled="loading" type="submit">Salvar</button>
        </div>
      </form>
    </div>
    <ConfirmDialog
      :open="!!archiving"
      :title="`Arquivar a conta “${archiving?.name}”?`"
      message="Ela deixa de aparecer para novos lançamentos, mas o histórico é preservado."
      confirm-label="Arquivar"
      :busy="archivingBusy"
      @confirm="confirmArchive"
      @cancel="archiving = null"
    />
  </main>
</template>

<style scoped>
.accounts-page {
  width: min(100%, 72rem);
  padding: 2rem;
}
.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}
.empty,
.account-form {
  background: var(--color-surface);
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: var(--shadow-surface);
}
.account-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-surface);
  padding: 0.85rem 0.9rem;
  border-radius: 0.9rem;
  box-shadow: var(--shadow-surface);
}
.account-card--archived {
  opacity: 0.75;
}
.entry-tap {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.15rem;
  text-align: left;
  background: transparent;
  color: inherit;
  font: inherit;
  border: 0;
  padding: 0;
  cursor: pointer;
  border-radius: 0.5rem;
}
.entry-tap:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.entry-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}
.entry-top h2 {
  margin: 0;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-amount {
  flex-shrink: 0;
  font-weight: 700;
}
.entry-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.danger {
  background: var(--color-error);
  color: var(--color-on-accent);
}
.badge {
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
  padding: 0.1rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.filter {
  display: flex;
  grid-template-columns: auto 1fr;
  align-items: center;
  margin: 1rem 0;
}
.filter input {
  width: auto;
}
.modal {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 2;
}
.account-form {
  width: min(100%, 30rem);
  max-height: 95vh;
  overflow: auto;
}
.account-form select {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text);
}
.link-button {
  background: none;
  color: var(--color-error);
  text-decoration: underline;
  padding: 0.2rem;
}
@media (max-width: 600px) {
  .accounts-page {
    padding: 1rem;
  }
}
</style>
