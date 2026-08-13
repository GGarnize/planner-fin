<script setup lang="ts">
/* global Event, KeyboardEvent, window */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { FinancialAccountType, InitialSetupDraft } from '@planner-fin/shared';
import {
  confirmInitialSetup,
  loadInitialSetup,
  previewInitialSetup,
  saveInitialSetupDraft,
  setupState,
} from '../initial-setup';

const router = useRouter();
const step = ref<InitialSetupDraft['step']>('INTRO');
const error = ref('');
const today = () => new Date().toISOString().slice(0, 10);
const draft = reactive<InitialSetupDraft>({
  step: 'INTRO',
  account: { name: '', type: 'CHECKING', openingBalance: null, openingBalanceDate: today() },
  categories: [],
});
const stepIndex = computed(() => ['INTRO', 'ACCOUNT', 'CATEGORIES', 'REVIEW'].indexOf(step.value) + 1);
const selectedCount = computed(() => draft.categories.filter((item) => item.selected).length);
const money = (value: string) => {
  const [, sign, amount, cents] = /^(-?)(\d+)\.(\d{2})$/.exec(value) ?? [];
  return amount ? `${sign}R$ ${amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}` : value;
};

function syncFromServer() {
  const data = setupState.data;
  const source = data?.draft;
  if (source) {
    Object.assign(draft.account, source.account);
    draft.categories.splice(0, draft.categories.length, ...source.categories);
    step.value = source.step;
  } else {
    draft.categories.splice(
      0,
      draft.categories.length,
      ...(data?.suggestions ?? []).map((item) => ({ ...item })),
    );
  }
}
function currentDraft(nextStep = step.value): InitialSetupDraft {
  return {
    step: nextStep,
    account: {
      name: draft.account.name,
      type: draft.account.type as FinancialAccountType,
      openingBalance: draft.account.openingBalance || null,
      openingBalanceDate: draft.account.openingBalanceDate,
    },
    categories: draft.categories.map((item) => ({ ...item })),
  };
}
async function save(nextStep: InitialSetupDraft['step']) {
  error.value = '';
  try {
    await saveInitialSetupDraft(currentDraft(nextStep));
    step.value = nextStep;
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : 'Nao foi possivel salvar.';
  }
}
async function next() {
  if (step.value === 'INTRO') return save('ACCOUNT');
  if (step.value === 'ACCOUNT') {
    if (!draft.account.name.trim()) {
      error.value = 'Informe o nome da conta.';
      return;
    }
    return save('CATEGORIES');
  }
  if (step.value === 'CATEGORIES') {
    await save('REVIEW');
    try {
      await previewInitialSetup();
    } catch (failure) {
      error.value = failure instanceof Error ? failure.message : 'Nao foi possivel revisar.';
    }
  }
}
function back() {
  if (step.value === 'INTRO') void router.push('/dashboard');
  else if (step.value === 'ACCOUNT') step.value = 'INTRO';
  else if (step.value === 'CATEGORIES') step.value = 'ACCOUNT';
  else step.value = 'CATEGORIES';
}
async function confirm() {
  error.value = '';
  try {
    if (!setupState.preview) await previewInitialSetup();
    await confirmInitialSetup();
    await router.push('/dashboard');
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : 'Nao foi possivel confirmar.';
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    back();
  }
}
function onAndroidBack(event: Event) {
  event.preventDefault();
  back();
}
onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('plannerfin:android-back', onAndroidBack, true);
  await loadInitialSetup();
  syncFromServer();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('plannerfin:android-back', onAndroidBack, true);
});
</script>

<template>
  <main class="setup-page">
    <header>
      <button type="button" class="back" aria-label="Voltar" @click="back">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <div>
        <p>Etapa {{ stepIndex }} de 4</p>
        <h1>Setup inicial</h1>
      </div>
    </header>
    <p v-if="setupState.loading" role="status">Carregando setup...</p>
    <p v-if="error || setupState.error" role="alert">{{ error || setupState.error }}</p>

    <section v-if="step === 'INTRO'" class="panel">
      <h2>Comece sem obrigacao</h2>
      <p>
        Este fluxo cria somente uma conta principal e as categorias que voce confirmar.
        Nenhum lancamento, salario ou recorrencia sera criado.
      </p>
      <button type="button" @click="next">Configurar agora</button>
    </section>

    <form v-else-if="step === 'ACCOUNT'" class="panel" @submit.prevent="next">
      <h2>Conta principal</h2>
      <label>Nome<input v-model="draft.account.name" required maxlength="120" /></label>
      <label
        >Tipo
        <select v-model="draft.account.type" required>
          <option value="CHECKING">Conta corrente</option>
          <option value="SAVINGS">Poupanca</option>
          <option value="CASH">Dinheiro</option>
          <option value="PAYMENT">Pagamento</option>
          <option value="OTHER">Outra</option>
        </select>
      </label>
      <label
        >Saldo inicial opcional
        <input v-model="draft.account.openingBalance" inputmode="decimal" placeholder="0.00" />
      </label>
      <label
        >Data da posicao inicial
        <input v-model="draft.account.openingBalanceDate" type="date" required />
      </label>
      <button :disabled="setupState.saving">Continuar</button>
    </form>

    <section v-else-if="step === 'CATEGORIES'" class="panel">
      <h2>Categorias sugeridas</h2>
      <p>Sao apenas sugestoes. Voce pode desmarcar todas.</p>
      <article v-for="category in draft.categories" :key="category.key" class="category-row">
        <label class="check"
          ><input v-model="category.selected" type="checkbox" />
          <span class="material-icons" aria-hidden="true">{{ category.icon.toLowerCase() }}</span>
        </label>
        <label
          ><span>{{ category.type === 'INCOME' ? 'Receita' : 'Despesa' }}</span>
          <input v-model="category.name" maxlength="80" />
        </label>
      </article>
      <button :disabled="setupState.saving" @click="next">Revisar</button>
    </section>

    <section v-else class="panel">
      <h2>Revisao</h2>
      <template v-if="setupState.preview">
        <p>
          Conta: {{ setupState.preview.summary.account.name }} -
          {{ setupState.preview.summary.account.type }}
        </p>
        <p>
          Saldo inicial:
          {{ money(setupState.preview.summary.account.openingBalance) }} em
          {{ setupState.preview.summary.account.openingBalanceDate }}
        </p>
        <p>{{ selectedCount }} categorias selecionadas. Nenhum lancamento sera criado.</p>
        <ul>
          <li v-for="category in setupState.preview.summary.categories" :key="category.name">
            {{ category.type === 'INCOME' ? 'Receita' : 'Despesa' }} - {{ category.name }}
          </li>
        </ul>
      </template>
      <button type="button" class="secondary" @click="back">Voltar</button>
      <button :disabled="setupState.saving" @click="confirm">Criar conta e categorias</button>
    </section>
  </main>
</template>

<style scoped>
.setup-page {
  width: min(100%, 42rem);
  margin: 0 auto;
  padding-bottom: calc(var(--shell-nav-height, 0px) + 1rem + env(safe-area-inset-bottom));
}
header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
header p {
  margin: 0;
  color: var(--color-text-muted);
}
.back {
  width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
}
.panel {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
}
.panel h2,
.panel p {
  margin: 0;
}
label {
  display: grid;
  gap: 0.35rem;
}
input,
select,
button {
  min-height: 2.75rem;
}
.category-row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
}
.check {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
@media (max-width: 40rem) {
  .setup-page {
    padding: 0 0 calc(var(--shell-nav-height, 0px) + 1rem + env(safe-area-inset-bottom));
  }
}
</style>
