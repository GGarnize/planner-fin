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
  <main v-if="authState.user" class="account-page">
    <header>
      <h1>Minha conta</h1>
      <p>{{ authState.user.name }}</p>
    </header>
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
    </section>
    <section class="danger-zone" aria-label="Ações de sessão">
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
.account-page header {
  margin-bottom: 0.75rem;
}
.account-page header p {
  margin: 0;
  color: #475569;
  overflow-wrap: anywhere;
}
.panel {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #fff;
  border: 1px solid #dbe2ea;
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
  color: #64748b;
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
  color: #0f172a;
  text-decoration: none;
  border-radius: 0.45rem;
}
.nav-link + .nav-link {
  border-top: 1px solid #e2e8f0;
}
.danger-zone {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #fecaca;
}
.danger-zone button {
  width: 100%;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #b42318;
  background: #fff;
  border: 1px solid #fecaca;
}
.material-icons {
  font-size: 1.25rem;
}
.nav-link:active,
.danger-zone button:active {
  background: #fff1f2;
}
.nav-link:focus-visible,
.danger-zone button:focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
}
</style>
