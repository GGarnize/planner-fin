<script setup lang="ts">
/* global document, window */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { catalogLabelFor, NOTIFICATION_APP_CATALOG } from '../notification-app-catalog';
import {
  getCaptureState,
  getNotificationAccessStatus,
  getObservedPackages,
  ignoreObservedPackage,
  isNotificationListenerDiagnosticAvailable,
  openNotificationAccessSettings,
  purgePendingQueue,
  restoreObservedPackage,
  type NotificationAccessStatus,
  type NotificationCaptureState,
  type ObservedNotificationPackage,
} from '../notification-listener';
import { pushNotificationPreferences } from '../notification-sync';
import { notificationsApi } from '../notifications-api';

const router = useRouter();

const status = ref<NotificationAccessStatus>({ supported: false, granted: false });
const captureState = ref<NotificationCaptureState>({
  captureEnabled: false,
  monitoredPackages: [],
  capturedCount: 0,
  secretDropped: 0,
});
const observedPackages = ref<ObservedNotificationPackage[]>([]);
const loading = ref(true);
const savingCapture = ref(false);
const savingApp = ref<string | null>(null);
const actionError = ref('');
const showAppManager = ref(false);
const showDisableChoice = ref(false);
const deletingHistory = ref(false);
const historyDeleted = ref(false);
const appSearch = ref('');

const isAndroid = computed(() => isNotificationListenerDiagnosticAvailable());
const monitoredCount = computed(() => captureState.value.monitoredPackages.length);
const knownPackageNames = computed(() => new Set(NOTIFICATION_APP_CATALOG.map((entry) => entry.packageName)));

function labelForPackage(packageName: string): string {
  return (
    catalogLabelFor(packageName) ??
    observedPackages.value.find((entry) => entry.packageName === packageName)?.label ??
    packageName
  );
}

function matchesSearch(label: string, packageName: string): boolean {
  const query = appSearch.value.trim().toLowerCase();
  if (!query) return true;
  return label.toLowerCase().includes(query) || packageName.toLowerCase().includes(query);
}

function formatLastSeen(lastSeenAt: number): string {
  return new Date(lastSeenAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const monitoredEntries = computed(() =>
  captureState.value.monitoredPackages.map((packageName) => ({
    packageName,
    label: labelForPackage(packageName),
  })),
);

// Observados neste dispositivo exclui apps já monitorados e apps do catálogo conhecido,
// para que um app conhecido+observado apareça uma única vez (na seção correspondente).
const visibleObserved = computed(() =>
  observedPackages.value
    .filter((entry) => !entry.ignoredAt)
    .filter((entry) => !captureState.value.monitoredPackages.includes(entry.packageName))
    .filter((entry) => !knownPackageNames.value.has(entry.packageName))
    .filter((entry) => matchesSearch(entry.label ?? entry.packageName, entry.packageName)),
);

const ignoredObserved = computed(() =>
  observedPackages.value
    .filter((entry) => !!entry.ignoredAt)
    .filter((entry) => !captureState.value.monitoredPackages.includes(entry.packageName))
    .filter((entry) => matchesSearch(entry.label ?? entry.packageName, entry.packageName)),
);

// Apps conhecidos exclui pacotes já monitorados, para que um app monitorado+conhecido
// (ex.: Nubank) apareça uma única vez, na seção Monitorados.
const visibleCatalog = computed(() =>
  NOTIFICATION_APP_CATALOG.filter((entry) => !captureState.value.monitoredPackages.includes(entry.packageName))
    .filter((entry) => matchesSearch(entry.label, entry.packageName)),
);

async function refresh() {
  status.value = await getNotificationAccessStatus();
  captureState.value = await getCaptureState();
  observedPackages.value = await getObservedPackages();
  loading.value = false;
}

function onVisible() {
  if (document.visibilityState === 'visible') void refresh();
}

onMounted(() => {
  void refresh();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', refresh);
});
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', refresh);
});

async function activate() {
  await openNotificationAccessSettings();
}

function notNow() {
  router.push('/mais');
}

async function enableCapture() {
  actionError.value = '';
  savingCapture.value = true;
  try {
    await pushNotificationPreferences({
      captureEnabled: true,
      monitoredPackages: captureState.value.monitoredPackages,
    });
    captureState.value = { ...captureState.value, captureEnabled: true };
  } catch {
    actionError.value = 'Não foi possível ligar a captura agora. Tente novamente.';
  } finally {
    savingCapture.value = false;
  }
}

function requestDisable() {
  showDisableChoice.value = true;
}

async function disableKeepHistory() {
  actionError.value = '';
  savingCapture.value = true;
  try {
    await pushNotificationPreferences({
      captureEnabled: false,
      monitoredPackages: captureState.value.monitoredPackages,
    });
    captureState.value = { ...captureState.value, captureEnabled: false };
    showDisableChoice.value = false;
  } catch {
    actionError.value = 'Não foi possível desligar a captura agora. Tente novamente.';
  } finally {
    savingCapture.value = false;
  }
}

async function disableAndDeleteHistory() {
  actionError.value = '';
  deletingHistory.value = true;
  try {
    await pushNotificationPreferences({
      captureEnabled: false,
      monitoredPackages: captureState.value.monitoredPackages,
    });
    await purgePendingQueue();
    await notificationsApi.deleteAllHistory();
    captureState.value = { ...captureState.value, captureEnabled: false };
    historyDeleted.value = true;
    showDisableChoice.value = false;
  } catch {
    actionError.value = 'Não foi possível apagar o histórico agora. Tente novamente.';
  } finally {
    deletingHistory.value = false;
  }
}

async function toggleApp(packageName: string) {
  actionError.value = '';
  const enabled = captureState.value.monitoredPackages.includes(packageName);
  const nextPackages = enabled
    ? captureState.value.monitoredPackages.filter((value) => value !== packageName)
    : [...captureState.value.monitoredPackages, packageName];
  savingApp.value = packageName;
  try {
    await pushNotificationPreferences({
      captureEnabled: captureState.value.captureEnabled,
      monitoredPackages: nextPackages,
    });
    captureState.value = { ...captureState.value, monitoredPackages: nextPackages };
  } catch {
    actionError.value = 'Não foi possível salvar a lista de apps agora. Tente novamente.';
  } finally {
    savingApp.value = null;
  }
}

// Opt-in explícito (SPEC-022 §F): sempre adiciona, nunca remove — a próxima notificação do
// app entra no pipeline normal; notificações anteriores ao opt-in não são recuperadas.
async function addToMonitored(packageName: string) {
  actionError.value = '';
  if (captureState.value.monitoredPackages.includes(packageName)) return;
  const nextPackages = [...captureState.value.monitoredPackages, packageName];
  savingApp.value = packageName;
  try {
    await pushNotificationPreferences({
      captureEnabled: captureState.value.captureEnabled,
      monitoredPackages: nextPackages,
    });
    captureState.value = { ...captureState.value, monitoredPackages: nextPackages };
  } catch {
    actionError.value = 'Não foi possível ativar o monitoramento agora. Tente novamente.';
  } finally {
    savingApp.value = null;
  }
}

async function ignoreObserved(packageName: string) {
  actionError.value = '';
  savingApp.value = packageName;
  try {
    observedPackages.value = await ignoreObservedPackage(packageName);
  } catch {
    actionError.value = 'Não foi possível ignorar este app agora. Tente novamente.';
  } finally {
    savingApp.value = null;
  }
}

async function restoreIgnored(packageName: string) {
  actionError.value = '';
  savingApp.value = packageName;
  try {
    observedPackages.value = await restoreObservedPackage(packageName);
  } catch {
    actionError.value = 'Não foi possível voltar a mostrar este app agora. Tente novamente.';
  } finally {
    savingApp.value = null;
  }
}
</script>

<template>
  <main class="notifications-page">
    <header>
      <h1>Captura por notificações</h1>
    </header>

    <section v-if="!isAndroid" class="panel unavailable">
      <span class="material-icons" aria-hidden="true">phonelink_off</span>
      <div>
        <h2>Disponível no app Android</h2>
        <p>
          Esta função só funciona no aplicativo Android do PlannerFin. O restante do PlannerFin
          continua funcionando normalmente aqui.
        </p>
      </div>
    </section>

    <template v-else-if="!loading">
      <section v-if="!status.granted" class="panel disclosure">
        <h2>Acesso às notificações: Desativado</h2>
        <p>
          O PlannerFin pode identificar possíveis movimentações nas notificações dos aplicativos
          que você escolher.
        </p>
        <p class="fine-print">
          Se você ativar esta função, o PlannerFin poderá ler o título e o texto das notificações
          dos aplicativos que você escolher para identificar possíveis compras, recebimentos,
          pagamentos e outras movimentações. O conteúdo selecionado poderá ser enviado por conexão
          segura ao servidor do PlannerFin para classificação e revisão. De apps não escolhidos, o
          PlannerFin guarda localmente apenas o identificador/nome do app e quando ele foi visto,
          para você poder selecioná-lo depois; o conteúdo da notificação não é armazenado nem
          enviado. Nada vira lançamento automaticamente: você sempre revisa e confirma. Você pode
          desligar a captura, remover um app e apagar o histórico aqui a qualquer momento. Consulte
          a
          <router-link to="/privacy-policy">Política de Privacidade do PlannerFin</router-link>
          para saber quais dados são tratados, por quanto tempo e como solicitar exclusão.
        </p>
        <div class="actions">
          <button type="button" class="primary" @click="activate">Ativar acesso</button>
          <button type="button" class="secondary" @click="notNow">Agora não</button>
        </div>
      </section>

      <template v-else>
        <section class="panel status-panel">
          <h2>Acesso Android: Ativo</h2>
          <dl>
            <div>
              <dt>Captura</dt>
              <dd>{{ captureState.captureEnabled ? 'Ligada' : 'Desligada' }}</dd>
            </div>
            <div>
              <dt>Apps monitorados</dt>
              <dd>{{ monitoredCount }}</dd>
            </div>
          </dl>
          <p v-if="actionError" role="alert">{{ actionError }}</p>
          <p v-if="historyDeleted" role="status">Histórico apagado.</p>

          <div class="actions">
            <button
              v-if="!captureState.captureEnabled"
              type="button"
              class="primary"
              :disabled="savingCapture"
              @click="enableCapture"
            >
              Ligar captura
            </button>
            <template v-else>
              <button
                type="button"
                class="secondary"
                :disabled="savingCapture"
                @click="requestDisable"
              >
                Desligar captura
              </button>
            </template>
            <button type="button" class="secondary" @click="showAppManager = !showAppManager">
              Gerenciar apps
            </button>
            <button type="button" class="secondary" @click="activate">
              Abrir configurações Android
            </button>
            <router-link class="secondary link-button" to="/notifications/inbox">
              Para revisar
            </router-link>
          </div>
        </section>

        <section v-if="showDisableChoice" class="panel disable-choice" role="alertdialog">
          <h2>Desligar captura</h2>
          <p>Você pode manter o histórico já capturado ou apagá-lo agora.</p>
          <div class="actions">
            <button type="button" class="secondary" :disabled="savingCapture" @click="disableKeepHistory">
              Desativar
            </button>
            <button
              type="button"
              class="danger"
              :disabled="deletingHistory"
              @click="disableAndDeleteHistory"
            >
              Desativar e apagar histórico
            </button>
            <button type="button" class="link-button" @click="showDisableChoice = false">
              Cancelar
            </button>
          </div>
        </section>

        <section v-if="showAppManager" class="panel app-manager" aria-label="Gerenciar apps">
          <h2>Gerenciar apps</h2>
          <p>
            Escolha quais aplicativos o PlannerFin pode monitorar para capturar conteúdo
            financeiro. Nenhum app é ativado por padrão.
          </p>

          <label class="search-field">
            <span class="material-icons" aria-hidden="true">search</span>
            <input
              v-model="appSearch"
              type="search"
              placeholder="Buscar por nome ou pacote"
              aria-label="Buscar apps"
            />
          </label>

          <div class="app-group">
            <h3>Monitorados</h3>
            <ul v-if="monitoredEntries.length" class="app-list">
              <li v-for="entry in monitoredEntries" :key="entry.packageName">
                <button
                  type="button"
                  class="choice"
                  aria-pressed="true"
                  :disabled="savingApp === entry.packageName"
                  @click="toggleApp(entry.packageName)"
                >
                  <span>
                    <strong>{{ entry.label }}</strong>
                    <small>{{ entry.packageName }}</small>
                  </span>
                  <span class="material-icons" aria-hidden="true">check_circle</span>
                </button>
              </li>
            </ul>
            <p v-else class="fine-print">Nenhum app monitorado ainda.</p>
          </div>

          <div class="app-group">
            <h3>Observados neste dispositivo</h3>
            <p class="fine-print">
              Somente nome do app/pacote e a última vez visto são guardados localmente aqui, até
              você escolher monitorar. O título e o texto da notificação só passam a ser capturados
              depois que você tocar em Monitorar.
            </p>
            <ul v-if="visibleObserved.length" class="app-list">
              <li v-for="entry in visibleObserved" :key="entry.packageName">
                <div class="choice observed-choice">
                  <span>
                    <strong>{{ entry.label ?? entry.packageName }}</strong>
                    <small>{{ entry.packageName }}</small>
                    <small>Visto em {{ formatLastSeen(entry.lastSeenAt) }}</small>
                  </span>
                  <button
                    type="button"
                    class="secondary"
                    :disabled="savingApp === entry.packageName"
                    @click="addToMonitored(entry.packageName)"
                  >
                    Monitorar
                  </button>
                  <button
                    type="button"
                    class="secondary"
                    :disabled="savingApp === entry.packageName"
                    @click="ignoreObserved(entry.packageName)"
                  >
                    Ignorar
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="fine-print">
              Nenhum app novo observado ainda. Apps que enviarem notificações após você ativar o
              acesso aparecem aqui.
            </p>
          </div>

          <div v-if="ignoredObserved.length" class="app-group">
            <h3>Ignorados ({{ ignoredObserved.length }})</h3>
            <ul class="app-list">
              <li v-for="entry in ignoredObserved" :key="entry.packageName">
                <div class="choice observed-choice">
                  <span>
                    <strong>{{ entry.label ?? entry.packageName }}</strong>
                    <small>{{ entry.packageName }}</small>
                  </span>
                  <button
                    type="button"
                    class="secondary"
                    :disabled="savingApp === entry.packageName"
                    @click="restoreIgnored(entry.packageName)"
                  >
                    Voltar a mostrar
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <div class="app-group">
            <h3>Apps conhecidos</h3>
            <ul v-if="visibleCatalog.length" class="app-list">
              <li v-for="entry in visibleCatalog" :key="entry.packageName">
                <button
                  type="button"
                  class="choice"
                  aria-pressed="false"
                  :disabled="savingApp === entry.packageName"
                  @click="toggleApp(entry.packageName)"
                >
                  <span>
                    <strong>{{ entry.label }}</strong>
                    <small>{{ entry.packageName }}</small>
                  </span>
                  <span class="material-icons" aria-hidden="true">radio_button_unchecked</span>
                </button>
              </li>
            </ul>
            <p v-else class="fine-print">Nenhum app conhecido encontrado.</p>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.notifications-page {
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
  margin: 0 0 0.5rem;
}
.unavailable {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}
.unavailable p {
  margin: 0;
  color: var(--color-text-muted);
}
.fine-print {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
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
.danger {
  color: var(--color-error);
  background: var(--color-error-container);
  border-color: var(--color-error-border);
}
dl {
  display: grid;
  gap: 0.6rem;
  margin: 0;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
dt {
  color: var(--color-text-muted);
}
dd {
  margin: 0;
  font-weight: 700;
}
.search-field {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.65rem;
  min-height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  background: var(--color-surface);
}
.search-field input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
}
.search-field input:focus-visible {
  outline: none;
}
.app-group {
  margin-top: 1rem;
}
.app-group h3 {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
}
.app-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.choice {
  width: 100%;
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem;
  text-align: left;
}
.observed-choice {
  grid-template-columns: minmax(0, 1fr) auto auto;
}
.choice[aria-pressed='true'] {
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
  border-color: var(--color-accent);
}
.choice strong,
.choice small {
  display: block;
}
.choice small {
  color: var(--color-text-muted);
}
button:focus-visible,
.link-button:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
