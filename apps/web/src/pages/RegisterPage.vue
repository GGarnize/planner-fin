<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { register } from '../auth';
const name = ref(''),
  email = ref(''),
  password = ref(''),
  loading = ref(false),
  error = ref('');
const router = useRouter();
async function submit() {
  error.value = '';
  if (
    !name.value.trim() ||
    !/\p{L}/u.test(password.value) ||
    !/\p{N}/u.test(password.value) ||
    password.value.length < 10
  ) {
    error.value = 'Use de 10 a 128 caracteres, com pelo menos uma letra e um número.';
    return;
  }
  loading.value = true;
  try {
    await register({ name: name.value, email: email.value, password: password.value });
    password.value = '';
    await router.push('/conta');
  } catch (e) {
    password.value = '';
    error.value = e instanceof Error ? e.message : 'Não foi possível cadastrar.';
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="card">
    <h1>Criar conta</h1>
    <form @submit.prevent="submit">
      <label>Nome<input v-model="name" required maxlength="120" autocomplete="name" /></label
      ><label>E-mail<input v-model="email" type="email" required autocomplete="email" /></label
      ><label
        >Senha<input
          v-model="password"
          type="password"
          required
          minlength="10"
          maxlength="128"
          autocomplete="new-password"
      /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button :disabled="loading">{{ loading ? 'Criando…' : 'Criar conta' }}</button>
    </form>
    <router-link to="/login">Já tenho conta</router-link>
  </main>
</template>
