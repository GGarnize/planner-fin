<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type {
  CreateFinancialAccountRequest,
  FinancialAccountType,
  PublicFinancialAccount,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';

const accounts = ref<PublicFinancialAccount[]>([]);
const loading = ref(false);
const error = ref('');
const includeArchived = ref(false);
const editingId = ref<string | null>(null);
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
    /^-?(0|[1-9][0-9]{0,16})(\.[0-9]{1,2})?$/.test(form.openingBalance) &&
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
    openingBalance: form.openingBalance,
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
async function archive(account: PublicFinancialAccount) {
  if (!globalThis.confirm(`Arquivar a conta “${account.name}”?`)) return;
  await action(account.id, 'archive');
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
const date = (value: string) => value.split('-').reverse().join('/');
onMounted(load);
</script>

<template>
  <main class="accounts-page">
    <header>
      <div>
        <router-link to="/conta">← Minha conta</router-link>
        <h1>Contas financeiras</h1>
        <p>Organize suas posições iniciais com segurança.</p>
      </div>
      <button @click="openCreate">Nova conta</button>
    </header>
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
      <article v-for="account in accounts" :key="account.id" class="account-card">
        <span v-if="account.archivedAt" class="badge">Arquivada</span>
        <h2>{{ account.name }}</h2>
        <p>
          {{ labels[account.type]
          }}<span v-if="account.institution"> · {{ account.institution }}</span>
        </p>
        <strong>Posição inicial: {{ money(account.openingBalance) }}</strong
        ><small>Data da posição inicial: {{ date(account.openingBalanceDate) }}</small>
        <strong v-if="account.realizedBalance === null">Saldo atual: ainda não disponível</strong
        ><strong v-else>Saldo atual: {{ money(account.realizedBalance) }}</strong>
        <div class="actions">
          <template v-if="account.archivedAt"
            ><button @click="action(account.id, 'restore')">Reativar</button></template
          ><template v-else
            ><button class="secondary" @click="openEdit(account)">Editar</button
            ><button class="danger" @click="archive(account)">Arquivar</button></template
          >
        </div>
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
  </main>
</template>

<style scoped>
.accounts-page {
  width: min(100%, 72rem);
  padding: 2rem;
}
.accounts-page > header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}
.account-card,
.empty,
.account-form {
  background: #fff;
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 0.5rem 2rem #0f172a18;
}
.account-card small,
.account-card strong {
  display: block;
  margin-top: 0.6rem;
}
.actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}
.secondary {
  background: #e2e8f0;
  color: #0f172a;
}
.danger {
  background: #b42318;
}
.badge {
  color: #475467;
  background: #eaecf0;
  padding: 0.2rem 0.5rem;
  border-radius: 1rem;
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
  background: #0f172a99;
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
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
.link-button {
  background: none;
  color: #b42318;
  text-decoration: underline;
  padding: 0.2rem;
}
@media (max-width: 600px) {
  .accounts-page {
    padding: 1rem;
  }
  .accounts-page > header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
