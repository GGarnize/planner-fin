<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  clearRecentCapturedNotifications,
  getCaptureState,
  getNotificationAccessStatus,
  getRecentCapturedNotifications,
  isNotificationListenerDiagnosticAvailable,
  openNotificationAccessSettings,
  setCaptureEnabled,
  setMonitoredPackages,
  type CapturedNotificationDebugEvent,
  type NotificationAccessStatus,
  type NotificationCaptureState,
} from '../notification-listener';

const status = ref<NotificationAccessStatus>({ supported: false, granted: false });
const state = ref<NotificationCaptureState>({
  captureEnabled: false,
  monitoredPackages: [],
  capturedCount: 0,
  secretDropped: 0,
});
const events = ref<CapturedNotificationDebugEvent[]>([]);
const packageInput = ref('');
const error = ref('');
const loading = ref(false);
const available = computed(() => isNotificationListenerDiagnosticAvailable());

function parsePackages(value: string): string[] {
  return value
    .split(/[\n, ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await getNotificationAccessStatus();
    state.value = await getCaptureState();
    packageInput.value = state.value.monitoredPackages.join('\n');
    const recent = await getRecentCapturedNotifications();
    events.value = recent.events;
    state.value = {
      ...state.value,
      capturedCount: recent.capturedCount,
      secretDropped: recent.secretDropped,
    };
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'Falha ao consultar diagnostico.';
  } finally {
    loading.value = false;
  }
}

async function toggleCapture() {
  state.value = await setCaptureEnabled(!state.value.captureEnabled);
  await refresh();
}

async function savePackages() {
  state.value = await setMonitoredPackages(parsePackages(packageInput.value));
  await refresh();
}

async function clearBuffer() {
  const result = await clearRecentCapturedNotifications();
  events.value = result.events;
  state.value = { ...state.value, capturedCount: 0, secretDropped: 0 };
}

onMounted(() => void refresh());
</script>

<template>
  <main class="notification-dev-page">
    <header>
      <p>Diagnostico Android local</p>
      <h1>Notification Listener</h1>
    </header>

    <p v-if="!available" role="status">
      Diagnostico disponivel somente no app Android nativo.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>

    <section>
      <h2>Acesso Android</h2>
      <dl>
        <div>
          <dt>Suportado</dt>
          <dd>{{ status.supported ? 'sim' : 'nao' }}</dd>
        </div>
        <div>
          <dt>Concedido</dt>
          <dd>{{ status.granted ? 'sim' : 'nao' }}</dd>
        </div>
      </dl>
      <div class="actions">
        <button :disabled="!available || loading" @click="refresh">Atualizar</button>
        <button :disabled="!available || loading" @click="openNotificationAccessSettings">
          Abrir Settings
        </button>
      </div>
    </section>

    <section>
      <h2>Captura efemera</h2>
      <dl>
        <div>
          <dt>captureEnabled</dt>
          <dd>{{ state.captureEnabled ? 'ligado' : 'desligado' }}</dd>
        </div>
        <div>
          <dt>Eventos no buffer</dt>
          <dd>{{ state.capturedCount }}</dd>
        </div>
        <div>
          <dt>Segredos descartados</dt>
          <dd>{{ state.secretDropped }}</dd>
        </div>
      </dl>
      <div class="actions">
        <button :disabled="!available || loading" @click="toggleCapture">
          {{ state.captureEnabled ? 'Desligar captura' : 'Ligar captura' }}
        </button>
        <button :disabled="!available || loading" @click="clearBuffer">Limpar buffer</button>
      </div>
    </section>

    <section>
      <h2>Pacotes monitorados</h2>
      <label>
        Package names, um por linha
        <textarea v-model="packageInput" rows="5" autocomplete="off" spellcheck="false" />
      </label>
      <button :disabled="!available || loading" @click="savePackages">Salvar pacotes</button>
    </section>

    <section>
      <h2>Eventos debug</h2>
      <p v-if="events.length === 0">Nenhum evento no buffer efemero.</p>
      <article v-for="event in events" :key="event.key">
        <h3>{{ event.packageName }}</h3>
        <dl>
          <div>
            <dt>key</dt>
            <dd>{{ event.key }}</dd>
          </div>
          <div>
            <dt>postTime</dt>
            <dd>{{ event.postTime }}</dd>
          </div>
          <div>
            <dt>title</dt>
            <dd>{{ event.title }}</dd>
          </div>
          <div>
            <dt>text</dt>
            <dd>{{ event.text }}</dd>
          </div>
          <div v-if="event.subText">
            <dt>subText</dt>
            <dd>{{ event.subText }}</dd>
          </div>
          <div v-if="event.bigText">
            <dt>bigText</dt>
            <dd>{{ event.bigText }}</dd>
          </div>
        </dl>
      </article>
    </section>
  </main>
</template>

<style scoped>
.notification-dev-page {
  max-width: 56rem;
  margin: 0 auto;
  padding: 1.5rem 0;
}
header p {
  margin: 0 0 0.25rem;
  color: var(--color-text-muted);
}
h1,
h2,
h3 {
  margin: 0;
}
section {
  padding: 1rem 0;
  border-top: 1px solid var(--color-border);
}
dl {
  display: grid;
  gap: 0.5rem;
}
dl div {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) 1fr;
  gap: 0.75rem;
}
dt {
  color: var(--color-text-muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
label {
  display: grid;
  gap: 0.5rem;
}
textarea {
  width: 100%;
  font: inherit;
}
article {
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border);
}
</style>
