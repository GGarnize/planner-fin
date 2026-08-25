<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ACCENTS, APPEARANCES, appearanceState, saveVisualPreferences } from '../appearance';
import { authState, authenticatedFetch, logout } from '../auth';
import PageHeader from '../components/PageHeader.vue';
import { loadInitialSetup, setupState } from '../initial-setup';

const router = useRouter();
const selectedAppearance = computed(() => appearanceState.current.appearance);
const selectedAccent = computed(() => appearanceState.current.accent);
const accentName = (value: string) => ACCENTS.find((item) => item.value === value)?.label ?? value;

async function leave() {
  await logout();
  await router.push('/login');
}
async function chooseAppearance(value: (typeof APPEARANCES)[number]['value']) {
  await saveVisualPreferences({ appearance: value }, authenticatedFetch);
}
async function chooseAccent(value: (typeof ACCENTS)[number]['value']) {
  await saveVisualPreferences({ accent: value }, authenticatedFetch);
}
void loadInitialSetup();
</script>

<template>
  <main v-if="authState.user" class="account-page">
    <PageHeader title="Minha conta" :description="authState.user.name" back-to="/mais" />
    <p v-if="authState.error" role="alert">{{ authState.error }}</p>
    <section class="panel">
      <h2>Dados da conta</h2>
      <dl>
        <div>
          <dt>E-mail</dt>
          <dd>{{ authState.user.email }}</dd>
        </div>
        <div>
          <dt>Cadastro</dt>
          <dd>{{ new Date(authState.user.createdAt).toLocaleDateString('pt-BR') }}</dd>
        </div>
      </dl>
    </section>
    <section class="panel account-links" aria-label="Atalhos da conta">
      <router-link class="nav-link" to="/accounts"
        ><span>Minhas contas financeiras</span
        ><span class="material-icons" aria-hidden="true">chevron_right</span></router-link
      >
      <router-link class="nav-link" to="/categories"
        ><span>Minhas categorias</span
        ><span class="material-icons" aria-hidden="true">chevron_right</span></router-link
      >
      <router-link
        v-if="
          setupState.data &&
          setupState.data.status !== 'COMPLETED' &&
          setupState.data.ineligibleReason !== 'HAS_FINANCIAL_DATA'
        "
        class="nav-link"
        to="/setup"
        ><span>Setup inicial</span
        ><span class="material-icons" aria-hidden="true">chevron_right</span></router-link
      >
    </section>
    <section class="panel appearance-panel" aria-labelledby="appearance-title">
      <div class="appearance-header">
        <div>
          <h2 id="appearance-title">Aparencia</h2>
          <p>Sincronizada entre web e Android.</p>
        </div>
        <span v-if="appearanceState.saving" role="status">Salvando...</span>
      </div>
      <fieldset>
        <legend>Tema</legend>
        <button
          v-for="item in APPEARANCES"
          :key="item.value"
          type="button"
          class="choice"
          :aria-pressed="selectedAppearance === item.value"
          @click="chooseAppearance(item.value)"
        >
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <span class="material-icons" aria-hidden="true">{{
            selectedAppearance === item.value ? 'check_circle' : 'radio_button_unchecked'
          }}</span>
        </button>
      </fieldset>
      <fieldset>
        <legend>Cor de destaque</legend>
        <button
          v-for="item in ACCENTS"
          :key="item.value"
          type="button"
          class="choice accent-choice"
          :data-accent-option="item.value"
          :aria-label="`Cor de destaque ${item.label}`"
          :aria-pressed="selectedAccent === item.value"
          @click="chooseAccent(item.value)"
        >
          <span class="accent-swatch" aria-hidden="true"></span>
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ selectedAccent === item.value ? 'Selecionada' : 'Disponivel' }}</small>
          </span>
          <span class="material-icons" aria-hidden="true">{{
            selectedAccent === item.value ? 'check_circle' : 'radio_button_unchecked'
          }}</span>
        </button>
      </fieldset>
      <p class="appearance-preview">
        Preview: tema {{ selectedAppearance.toLowerCase() }} com destaque
        {{ accentName(selectedAccent) }}.
      </p>
      <p v-if="appearanceState.savedMessage" role="status">{{ appearanceState.savedMessage }}</p>
      <p v-if="appearanceState.error" role="alert">
        {{ appearanceState.error }}
        <button type="button" class="retry" @click="chooseAppearance(selectedAppearance)">
          Tentar novamente
        </button>
      </p>
    </section>
    <section class="danger-zone" aria-label="Acoes de sessao">
      <button @click="leave">
        <span class="material-icons" aria-hidden="true">logout</span>
        Sair
      </button>
    </section>
  </main>
</template>

<style scoped>
.account-page {
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
.panel h2 {
  margin: 0 0 0.75rem;
}
dl {
  display: grid;
  gap: 0.7rem;
  margin: 0;
}
dl div {
  display: grid;
  gap: 0.2rem;
}
dt {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
dd {
  margin: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.account-links {
  padding: 0.35rem;
}
.nav-link {
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: 1fr 1.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  color: var(--color-text);
  text-decoration: none;
  border-radius: 0.45rem;
}
.nav-link + .nav-link {
  border-top: 1px solid var(--color-border);
}
.appearance-panel {
  display: grid;
  gap: 0.8rem;
}
.appearance-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.appearance-header h2,
.appearance-header p {
  margin: 0;
}
.appearance-header p,
.choice small,
.appearance-preview {
  color: var(--color-text-muted);
}
fieldset {
  min-width: 0;
  display: grid;
  gap: 0.5rem;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: 0.25rem;
  font-weight: 700;
}
.choice {
  width: 100%;
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem;
  color: var(--color-text);
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.choice:hover,
.choice:active,
.choice[aria-pressed='true'] {
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
  border-color: var(--color-accent);
}
.choice strong,
.choice small {
  display: block;
}
.accent-choice {
  grid-template-columns: 1.75rem minmax(0, 1fr) 1.5rem;
}
.accent-swatch {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: var(--color-accent);
}
[data-accent-option='BLUE'] .accent-swatch {
  background: #155eef;
}
[data-accent-option='TEAL'] .accent-swatch {
  background: #0f766e;
}
[data-accent-option='PURPLE'] .accent-swatch {
  background: #7c3aed;
}
[data-accent-option='ORANGE'] .accent-swatch {
  background: #c2410c;
}
.retry {
  min-height: 2.75rem;
  margin-left: 0.5rem;
  color: var(--color-error);
  background: var(--color-error-container);
  border: 1px solid var(--color-error-border);
}
.danger-zone {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-error-border);
}
.danger-zone button {
  width: 100%;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--color-error);
  background: var(--color-surface);
  border: 1px solid var(--color-error-border);
}
.material-icons {
  font-size: 1.25rem;
}
.nav-link:active,
.danger-zone button:active {
  background: var(--color-error-container);
}
.nav-link:focus-visible,
.danger-zone button:focus-visible,
.choice:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
