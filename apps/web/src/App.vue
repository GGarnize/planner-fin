<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchHealth, type HealthState } from './health';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const healthState = ref<HealthState>('loading');

onMounted(async () => {
  healthState.value = await fetchHealth(apiBaseUrl);
});
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="page column items-center justify-center q-pa-lg">
        <main class="technical-card text-center">
          <h1>PlannerFin</h1>
          <p>Scaffold técnico inicial ativo.</p>
          <p v-if="healthState === 'loading'" role="status">carregando</p>
          <p v-else-if="healthState === 'available'" role="status">API disponível</p>
          <p v-else role="status">API indisponível</p>
        </main>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fb;
}
.technical-card {
  width: min(100%, 36rem);
  border-radius: 1rem;
  background: white;
  padding: 2rem;
  box-shadow: 0 1rem 3rem rgba(15, 23, 42, 0.12);
}
h1 {
  margin: 0 0 1rem;
  color: #0f172a;
}
p {
  color: #334155;
}
</style>
