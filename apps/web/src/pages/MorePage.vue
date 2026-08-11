<script setup lang="ts">
import { useRouter } from 'vue-router';
import { logout } from '../auth';
const router = useRouter();
const groups = [
  {
    title: 'Movimentação',
    items: [
      ['Contas', '/accounts', 'account_balance'],
      ['Categorias', '/categories', 'category'],
      ['Transferências', '/transfers', 'swap_horiz'],
    ],
  },
  { title: 'Planejamento', items: [['Recorrências', '/recurrences', 'event_repeat']] },
  {
    title: 'Crédito e compromissos',
    items: [
      ['Cartões', '/cards', 'credit_card'],
      ['Dívidas', '/debts', 'request_quote'],
    ],
  },
] as const;
async function leave() {
  await logout();
  await router.push('/login');
}
</script>
<template>
  <main class="more-page">
    <h1>Mais</h1>
    <section v-for="group in groups" :key="group.title">
      <h2>{{ group.title }}</h2>
      <router-link v-for="item in group.items" :key="item[1]" :to="item[1]"
        ><span class="material-icons" aria-hidden="true">{{ item[2] }}</span
        ><span>{{ item[0] }}</span
        ><span aria-hidden="true">chevron_right</span></router-link
      >
    </section>
    <section>
      <h2>Conta</h2>
      <router-link to="/conta"
        ><span class="material-icons" aria-hidden="true">person</span><span>Perfil e conta</span
        ><span aria-hidden="true">chevron_right</span></router-link
      ><button @click="leave">
        <span class="material-icons" aria-hidden="true">logout</span>Sair
      </button>
    </section>
  </main>
</template>
<style scoped>
.more-page {
  width: min(100%, 42rem);
  margin: 0 auto;
}
.more-page > h1 {
  margin: 0.25rem 0 1rem;
}
.more-page section {
  margin-bottom: 1.25rem;
}
.more-page h2 {
  margin: 0.5rem 0;
}
.more-page a,
.more-page button {
  width: 100%;
  min-height: 3.25rem;
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #0f172a;
  text-align: left;
  text-decoration: none;
  background: #fff;
  border: 1px solid #dbe2ea;
  border-radius: 0.65rem;
  margin: 0.4rem 0;
}
.more-page button {
  color: #b42318;
}
</style>
