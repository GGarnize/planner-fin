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
      ['Modelos de lançamento', '/transaction-templates', 'content_copy'],
      ['Importar extrato', '/imports', 'upload_file'],
      [
        'Captura por notificações',
        '/notifications',
        'notifications',
        'Use notificações de apps financeiros para preparar movimentações para revisão.',
      ],
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
        ><span
          ><span class="item-label">{{ item[0] }}</span
          ><small v-if="item[3]" class="item-description">{{ item[3] }}</small></span
        ><span class="material-icons" aria-hidden="true">chevron_right</span></router-link
      >
    </section>
    <section>
      <h2>Conta</h2>
      <router-link to="/conta"
        ><span class="material-icons" aria-hidden="true">person</span><span>Perfil e conta</span
        ><span class="material-icons" aria-hidden="true">chevron_right</span></router-link
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
  margin: 0.25rem 0 0.75rem;
}
.more-page section {
  margin-bottom: 1rem;
}
.more-page h2 {
  margin: 0.4rem 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
}
.more-page a,
.more-page button {
  width: 100%;
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: 1.75rem 1fr 1.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  color: var(--color-text);
  text-align: left;
  text-decoration: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin: 0.35rem 0;
}
.more-page button {
  color: var(--color-error);
  background: var(--color-surface);
}
.more-page a:active,
.more-page button:active {
  background: var(--color-accent-container);
}
.more-page a:focus-visible,
.more-page button:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
.material-icons {
  font-size: 1.25rem;
}
.item-label {
  display: block;
}
.item-description {
  display: block;
  color: var(--color-text-muted);
  font-weight: 400;
  white-space: normal;
}
</style>
