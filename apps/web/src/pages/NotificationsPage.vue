<script setup lang="ts">
/* global document, window */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NOTIFICATION_APP_CATALOG } from '../notification-app-catalog';
import {
  getCaptureState,
  getNotificationAccessStatus,
  isNotificationListenerDiagnosticAvailable,
  openNotificationAccessSettings,
  type NotificationAccessStatus,
  type NotificationCaptureState,
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
const loading = ref(true);
const savingCapture = ref(false);
const savingApp = ref<string | null>(null);
const actionError = ref('');
const showAppManager = ref(false);
const showDisableChoice = ref(false);
const deletingHistory = ref(false);
const historyDeleted = ref(false);

const isAndroid = computed(() => isNotificationListenerDiagnosticAvailable());
const monitoredCount = computed(() => captureState.value.monitoredPackages.length);

async function refresh() {
  status.value = await getNotificationAccessStatus();
  captureState.value = await getCaptureState();
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
    captureState.value = { ...captureState.value, captureEnabled: false };
    await notificationsApi.deleteAllHistory();
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
          segura ao servidor do PlannerFin para classificação e revisão. Notificações de apps não
          escolhidos não são armazenadas nem enviadas. Nada vira lançamento automaticamente: você
          sempre revisa e confirma. Você pode desligar a captura, remover um app e apagar o
          histórico aqui a qualquer momento. Consulte a Política de Privacidade do PlannerFin para
          saber quais dados são tratados, por quanto tempo e como solicitar exclusão.
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

        <section v-if="showAppManager" class="panel app-manager" aria-label="Apps monitorados">
          <h2>Apps monitorados</h2>
          <p>Escolha quais aplicativos o PlannerFin pode observar. Nenhum app é ativado por padrão.</p>
          <ul class="app-list">
            <li v-for="entry in NOTIFICATION_APP_CATALOG" :key="entry.packageName">
              <button
                type="button"
                class="choice"
                :aria-pressed="captureState.monitoredPackages.includes(entry.packageName)"
                :disabled="savingApp === entry.packageName"
                @click="toggleApp(entry.packageName)"
              >
                <span>
                  <strong>{{ entry.label }}</strong>
                  <small>{{ entry.packageName }}</small>
                </span>
                <span class="material-icons" aria-hidden="true">{{
                  captureState.monitoredPackages.includes(entry.packageName)
                    ? 'check_circle'
                    : 'radio_button_unchecked'
                }}</span>
              </button>
            </li>
          </ul>
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
