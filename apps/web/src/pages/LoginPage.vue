<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../auth';
const email = ref(''),
  password = ref(''),
  loading = ref(false),
  error = ref(''),
  showPassword = ref(false);
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
        : '/dashboard';
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
        >Senha
        <div class="password-field">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            maxlength="128"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="toggle-password"
            :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <span class="material-icons" aria-hidden="true">{{
              showPassword ? 'visibility_off' : 'visibility'
            }}</span>
          </button>
        </div>
      </label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
    </form>
    <router-link to="/cadastro">Criar conta</router-link>
  </main>
</template>
<style scoped>
.password-field {
  position: relative;
  display: flex;
}
.password-field input {
  width: 100%;
  padding-right: 2.75rem;
}
.toggle-password {
  position: absolute;
  inset: 0 0 0 auto;
  width: 2.75rem;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  color: var(--color-text-muted);
  border: 0;
}
.toggle-password:hover {
  background: transparent;
  color: var(--color-text);
}
</style>
