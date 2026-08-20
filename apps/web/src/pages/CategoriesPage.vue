<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type {
  CreateFinancialCategoryRequest,
  FinancialCategoryIcon,
  FinancialCategoryType,
  PublicFinancialCategory,
} from '@planner-fin/shared';
import { authenticatedFetch } from '../auth';
import KebabMenu, { type KebabMenuAction } from '../components/KebabMenu.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import CategoryIcon from '../components/CategoryIcon.vue';
import { CATEGORY_ICON_OPTIONS, validCategoryColor } from '../category-icon';
const categories = ref<PublicFinancialCategory[]>([]),
  loading = ref(false),
  error = ref(''),
  includeArchived = ref(false),
  filterType = ref<'' | FinancialCategoryType>('');
const showForm = ref(false),
  editingId = ref<string | null>(null);
const archiving = ref<PublicFinancialCategory | null>(null),
  archivingBusy = ref(false);
const initial = (): CreateFinancialCategoryRequest => ({
  name: '',
  type: 'EXPENSE',
  color: null,
  icon: null,
});
const form = reactive(initial());
const icons = CATEGORY_ICON_OPTIONS satisfies Array<{ value: FinancialCategoryIcon; label: string }>;
const grouped = computed(() => ({
  INCOME: categories.value.filter((item) => item.type === 'INCOME'),
  EXPENSE: categories.value.filter((item) => item.type === 'EXPENSE'),
}));
async function api(path: string, init?: Parameters<typeof authenticatedFetch>[1]) {
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
  const query = new globalThis.URLSearchParams();
  if (includeArchived.value) query.set('includeArchived', 'true');
  if (filterType.value) query.set('type', filterType.value);
  try {
    categories.value = (await api(
      `/categories${query.size ? `?${query}` : ''}`,
    )) as PublicFinancialCategory[];
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
function create(type: FinancialCategoryType = 'EXPENSE') {
  Object.assign(form, initial(), { type });
  editingId.value = null;
  showForm.value = true;
}
function edit(item: PublicFinancialCategory) {
  Object.assign(form, { name: item.name, type: item.type, color: item.color, icon: item.icon });
  editingId.value = item.id;
  showForm.value = true;
}
function valid() {
  const length = Array.from(form.name.trim()).length;
  return (
    length >= 1 &&
    length <= 80 &&
    !Array.from(form.name).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || (code >= 127 && code <= 159);
    }) &&
    (!form.color || /^#[0-9A-Fa-f]{6}$/.test(form.color))
  );
}
function categoryBorderColor(color: string | null) {
  return validCategoryColor(color) && color ? color : 'var(--color-border)';
}
async function save() {
  if (!valid()) {
    error.value = 'Informe um nome válido e uma cor no formato #RRGGBB.';
    return;
  }
  loading.value = true;
  error.value = '';
  const payload = editingId.value
    ? { name: form.name.trim(), color: form.color, icon: form.icon }
    : { ...form, name: form.name.trim() };
  try {
    await api(editingId.value ? `/categories/${editingId.value}` : '/categories', {
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
function actionsFor(item: PublicFinancialCategory): KebabMenuAction[] {
  if (item.archivedAt) return [{ label: 'Reativar', onSelect: () => action(item, 'restore') }];
  return [
    { label: 'Editar', onSelect: () => edit(item) },
    { label: 'Arquivar', danger: true, onSelect: () => (archiving.value = item) },
  ];
}
async function confirmArchive() {
  if (!archiving.value || archivingBusy.value) return;
  archivingBusy.value = true;
  try {
    await action(archiving.value, 'archive');
    archiving.value = null;
  } finally {
    archivingBusy.value = false;
  }
}
async function action(item: PublicFinancialCategory, operation: 'archive' | 'restore') {
  loading.value = true;
  try {
    await api(`/categories/${item.id}/${operation}`, { method: 'POST' });
    await load();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'API indisponível.';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <main class="categories-page">
    <header>
      <div>
        <router-link to="/conta">← Minha conta</router-link>
        <h1>Categorias financeiras</h1>
        <p>Organize receitas e despesas sem misturar suas naturezas.</p>
      </div>
      <button @click="create()">Nova categoria</button>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button class="link" @click="load">Tentar novamente</button>
    </p>
    <div class="filters">
      <label
        >Natureza<select v-model="filterType" @change="load">
          <option value="">Todas</option>
          <option value="INCOME">Receitas</option>
          <option value="EXPENSE">Despesas</option>
        </select></label
      ><label class="check"
        ><input v-model="includeArchived" type="checkbox" @change="load" /> Incluir
        arquivadas</label
      >
    </div>
    <p v-if="loading" aria-live="polite">Carregando…</p>
    <section v-else-if="!categories.length" class="empty">
      <h2>Nenhuma categoria encontrada</h2>
      <p>Crie manualmente sua primeira categoria.</p>
      <button @click="create()">Criar categoria</button>
    </section>
    <div v-else class="groups">
      <section
        v-for="type in ['INCOME', 'EXPENSE'] as const"
        v-show="grouped[type].length"
        :key="type"
      >
        <h2>{{ type === 'INCOME' ? 'Receitas' : 'Despesas' }}</h2>
        <div class="grid">
          <article
            v-for="item in grouped[type]"
            :key="item.id"
            class="category"
            :style="{ borderColor: categoryBorderColor(item.color) }"
          >
            <button type="button" class="entry-tap" @click="edit(item)">
              <CategoryIcon :icon="item.icon" :color="item.color" :label="item.name" />
              <span class="entry-text">
                <span class="entry-name"
                  >{{ item.name }}<span v-if="item.archivedAt" class="badge">Arquivada</span></span
                ><span class="entry-sub">{{ item.type === 'INCOME' ? 'Receita' : 'Despesa' }}</span>
              </span>
            </button>
            <KebabMenu :label="`Ações de ${item.name}`" :actions="actionsFor(item)" />
          </article>
        </div>
      </section>
    </div>
    <div
      v-if="showForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-form-title"
    >
      <form @submit.prevent="save">
        <h2 id="category-form-title">{{ editingId ? 'Editar categoria' : 'Nova categoria' }}</h2>
        <label>Nome<input v-model="form.name" maxlength="80" required /></label
        ><label
          >Natureza<select v-model="form.type" :disabled="!!editingId">
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </select></label
        ><label>Cor (opcional)<input v-model="form.color" type="color" /></label
        ><label
          >Ícone (opcional)<select v-model="form.icon">
            <option :value="null">Sem ícone</option>
            <option v-for="item in icons" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select></label
        >
        <div class="actions">
          <button type="button" class="secondary" @click="showForm = false">Cancelar</button
          ><button :disabled="loading">Salvar</button>
        </div>
      </form>
    </div>
    <ConfirmDialog
      :open="!!archiving"
      :title="`Arquivar a categoria “${archiving?.name}”?`"
      message="Ela deixa de aparecer para novos lançamentos, mas o histórico é preservado."
      confirm-label="Arquivar"
      :busy="archivingBusy"
      @confirm="confirmArchive"
      @cancel="archiving = null"
    />
  </main>
</template>
<style scoped>
.categories-page {
  width: min(100%, 72rem);
  padding: 2rem;
}
.categories-page > header,
.filters,
.actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}
.filters {
  justify-content: flex-start;
  margin: 1rem 0;
}
.filters label {
  display: flex;
  gap: 0.5rem;
}
.check input {
  width: auto;
}
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1.5rem;
}
.grid {
  display: grid;
  gap: 0.5rem;
}
.empty,
form {
  background: var(--color-surface);
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: var(--shadow-surface);
}
.category {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-surface);
  padding: 0.6rem 0.75rem;
  border-radius: 0.9rem;
  border-left: 4px solid;
  box-shadow: var(--shadow-surface);
}
.entry-tap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.65rem;
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
.entry-text {
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}
.entry-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-sub {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.badge {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  padding: 0.1rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.danger {
  background: var(--color-error);
  color: var(--color-on-accent);
}
.link {
  background: none;
  color: var(--color-error);
  text-decoration: underline;
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
.modal form {
  width: min(100%, 30rem);
  background: var(--color-surface);
  padding: 1.25rem;
  border-radius: 1rem;
  box-shadow: var(--shadow-overlay);
}
select {
  font: inherit;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text);
}
@media (max-width: 600px) {
  .categories-page {
    padding: 1rem;
  }
  .categories-page > header,
  .filters {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
