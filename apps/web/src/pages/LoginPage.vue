<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../auth';
const email = ref(''),
  password = ref(''),
  loading = ref(false),
  error = ref('');
const router = useRouter(),
  route = useRoute();
async function submit() {
  error.value = '';
  if (!email.value || !password.value) {
    error.value = 'E-mail ou senha inválidos.';
    return;
  }
  loading.value = true;
  try {
    await login({ email: email.value, password: password.value });
    password.value = '';
    const destination =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/conta';
    await router.push(destination);
  } catch (e) {
    password.value = '';
    error.value = e instanceof Error ? e.message : 'Não foi possível entrar.';
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="card">
    <h1>Entrar</h1>
    <form @submit.prevent="submit">
      <label>E-mail<input v-model="email" type="email" required autocomplete="email" /></label
      ><label
        >Senha<input
          v-model="password"
          type="password"
          required
          maxlength="128"
          autocomplete="current-password"
      /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </form>
    <router-link to="/cadastro">Criar conta</router-link>
  </main>
</template>
