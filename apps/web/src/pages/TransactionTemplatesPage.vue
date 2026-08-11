<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type {
  PublicFinancialAccount,
  PublicFinancialCategory,
  PublicTransactionTemplate,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import { templateErrorMessage } from '../transaction-template';
const items = ref<PublicTransactionTemplate[]>([]),
  accounts = ref<PublicFinancialAccount[]>([]),
  categories = ref<PublicFinancialCategory[]>([]),
  includeArchived = ref(false),
  showForm = ref(false),
  editing = ref<PublicTransactionTemplate | null>(null),
  loading = ref(false),
  error = ref(''),
  confirming = ref<PublicTransactionTemplate | null>(null);
const form = reactive({
  name: '',
  type: 'EXPENSE',
  categoryId: '',
  description: '',
  plannedAmount: '',
  defaultAccountId: '',
  notes: '',
  dueDay: '',
});
const compatible = computed(() =>
  categories.value.filter((c) => !c.archivedAt && c.type === form.type),
);
async function api<T>(path: string, init?: Parameters<typeof authenticatedFetch>[1]): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = new Error(templateErrorMessage(body.error?.code));
    (e as Error & { code?: string }).code = body.error?.code;
    throw e;
  }
  return body as T;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await api(
      `/transaction-templates${includeArchived.value ? '?includeArchived=true' : ''}`,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao carregar.';
  } finally {
    loading.value = false;
  }
}
function open(item?: PublicTransactionTemplate) {
  editing.value = item ?? null;
  Object.assign(
    form,
    item
      ? {
          name: item.name,
          type: item.type,
          categoryId: item.categoryAvailable ? item.categoryId : '',
          description: item.description,
          plannedAmount: item.plannedAmount,
          defaultAccountId: item.defaultAccountAvailable ? (item.defaultAccountId ?? '') : '',
          notes: item.notes ?? '',
          dueDay: item.dueDay?.toString() ?? '',
        }
      : {
          name: '',
          type: 'EXPENSE',
          categoryId: '',
          description: '',
          plannedAmount: '',
          defaultAccountId: '',
          notes: '',
          dueDay: '',
        },
  );
  error.value = '';
  showForm.value = true;
}
async function save() {
  error.value = '';
  if (
    !form.name.trim() ||
    !form.categoryId ||
    !form.description.trim() ||
    !/^\d+(?:[.,]\d{1,2})?$/.test(form.plannedAmount)
  ) {
    error.value = 'Preencha nome, categoria, descrição e valor positivo.';
    return;
  }
  const dueDay = form.dueDay ? Number(form.dueDay) : null;
  if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
    error.value = 'O dia sugerido deve estar entre 1 e 31.';
    return;
  }
  loading.value = true;
  try {
    await api(`/transaction-templates${editing.value ? `/${editing.value.id}` : ''}`, {
      method: editing.value ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        type: form.type,
        categoryId: form.categoryId,
        description: form.description.trim(),
        plannedAmount: Number(form.plannedAmount.replace(',', '.')).toFixed(2),
        defaultAccountId: form.defaultAccountId || null,
        notes: form.notes || null,
        dueDay,
      }),
    });
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao salvar.';
  } finally {
    loading.value = false;
  }
}
async function archive() {
  if (!confirming.value) return;
  try {
    await api(`/transaction-templates/${confirming.value.id}/archive`, { method: 'POST' });
    confirming.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao arquivar.';
  }
}
async function restore(item: PublicTransactionTemplate) {
  try {
    await api(`/transaction-templates/${item.id}/restore`, { method: 'POST' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha ao restaurar.';
  }
}
onMounted(async () => {
  try {
    [accounts.value, categories.value] = await Promise.all([
      api<PublicFinancialAccount[]>('/accounts'),
      api<PublicFinancialCategory[]>('/categories'),
    ]);
    await load();
  } catch {
    error.value = 'Não foi possível carregar os modelos.';
  }
});
</script>
<template>
  <main class="templates-page">
    <header>
      <div>
        <router-link to="/mais">← Mais</router-link>
        <h1>Modelos de lançamento</h1>
      </div>
      <button @click="open()">Novo modelo</button>
    </header>
    <label class="toggle"
      ><input v-model="includeArchived" type="checkbox" @change="load" /> Incluir arquivados</label
    >
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="!items.length" class="empty">
      <h2>Nenhum modelo {{ includeArchived ? 'encontrado' : 'ativo' }}</h2>
      <p>Crie um modelo para preencher lançamentos com menos digitação.</p>
    </section>
    <section class="list">
      <article v-for="item in items" :key="item.id">
        <header>
          <div>
            <h2>{{ item.name }}</h2>
            <span
              >{{ item.type === 'INCOME' ? 'Receita' : 'Despesa' }} ·
              {{ item.archivedAt ? 'Arquivado' : 'Ativo' }}</span
            >
          </div>
          <strong>{{ item.plannedAmount }}</strong>
        </header>
        <p>{{ item.description }}</p>
        <p>
          Categoria: {{ categories.find((c) => c.id === item.categoryId)?.name ?? 'Indisponível'
          }}<template v-if="item.defaultAccountId">
            · Conta:
            {{
              accounts.find((a) => a.id === item.defaultAccountId)?.name ?? 'Indisponível'
            }}</template
          ><template v-if="item.dueDay"> · Dia {{ item.dueDay }}</template>
        </p>
        <div class="actions">
          <button class="secondary" @click="open(item)">Editar</button
          ><button v-if="!item.archivedAt" class="danger" @click="confirming = item">
            Arquivar</button
          ><button v-else @click="restore(item)">Restaurar</button>
        </div>
      </article>
    </section>
    <div v-if="showForm" class="backdrop">
      <form novalidate @submit.prevent="save">
        <h2>{{ editing ? 'Editar' : 'Novo' }} modelo</h2>
        <p v-if="error" role="alert">{{ error }}</p>
        <label>Nome<input v-model="form.name" maxlength="120" required /></label
        ><label
          >Natureza<select v-model="form.type">
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </select></label
        ><label
          >Categoria<select v-model="form.categoryId" required>
            <option value="">Selecione</option>
            <option v-for="c in compatible" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select></label
        ><label>Descrição<input v-model="form.description" maxlength="200" required /></label
        ><label
          >Valor previsto<input v-model="form.plannedAmount" inputmode="decimal" required /></label
        ><label
          >Conta padrão (opcional)<select v-model="form.defaultAccountId">
            <option value="">Nenhuma</option>
            <option v-for="a in accounts.filter((a) => !a.archivedAt)" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select></label
        ><label
          >Dia sugerido (opcional)<input
            v-model="form.dueDay"
            type="number"
            min="1"
            max="31" /></label
        ><label>Notas (opcional)<textarea v-model="form.notes" maxlength="2000"></textarea></label>
        <div class="actions">
          <button type="button" class="secondary" @click="showForm = false">Cancelar</button
          ><button :disabled="loading">{{ loading ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </div>
    <div v-if="confirming" class="backdrop">
      <section class="confirm" role="dialog" aria-modal="true">
        <h2>Arquivar modelo?</h2>
        <p>Ele deixará de aparecer em “Usar modelo...”.</p>
        <div class="actions">
          <button class="secondary" @click="confirming = null">Cancelar</button
          ><button class="danger" @click="archive">Arquivar</button>
        </div>
      </section>
    </div>
  </main>
</template>
<style scoped>
.templates-page {
  width: min(100%, 60rem);
  margin: 0 auto;
  padding: 1.5rem;
}
.templates-page > header,
.list article > header,
.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: center;
}
.templates-page h1 {
  margin: 0.25rem 0;
}
.toggle {
  display: flex;
  grid-template-columns: auto 1fr;
  align-items: center;
  margin: 1rem 0;
}
.toggle input {
  min-height: 44px;
}
.list {
  display: grid;
  gap: 0.75rem;
}
.list article,
.empty,
form,
.confirm {
  padding: 1rem;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 0.25rem 1rem #0f172a12;
}
.list h2 {
  margin: 0;
}
.secondary {
  background: #e2e8f0;
  color: #0f172a;
}
.danger {
  background: #b42318;
}
.backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: #0f172a88;
}
.backdrop form {
  width: min(100%, 34rem);
  max-height: calc(100dvh - 2rem);
  overflow: auto;
}
.confirm {
  width: min(100%, 26rem);
}
@media (max-width: 767px) {
  .templates-page {
    padding: 0;
  }
  .templates-page > header {
    align-items: flex-end;
  }
  .list article > header {
    align-items: flex-start;
  }
  .actions button {
    flex: 1;
  }
}
</style>
