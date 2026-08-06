<script setup lang="ts">
import { useRouter } from 'vue-router';
import { authState, logout } from '../auth';
const router = useRouter();
async function leave() {
  await logout();
  await router.push('/login');
}
</script>
<template>
  <main class="card" v-if="authState.user">
    <h1>Minha conta</h1>
    <p>Olá, {{ authState.user.name }}.</p>
    <dl>
      <dt>E-mail</dt>
      <dd>{{ authState.user.email }}</dd>
      <dt>Cadastro</dt>
      <dd>{{ new Date(authState.user.createdAt).toLocaleDateString('pt-BR') }}</dd>
    </dl>
    <p v-if="authState.error" role="alert">{{ authState.error }}</p>
    <button @click="leave">Sair</button>
  </main>
</template>
