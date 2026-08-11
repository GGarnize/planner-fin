<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const choosingType = ref(false);
const primary = [
  { label: 'Início', icon: 'home', to: '/dashboard', matches: ['/dashboard'] },
  { label: 'Lançamentos', icon: 'receipt_long', to: '/transactions', matches: ['/transactions'] },
  { label: 'Orçamento', icon: 'account_balance_wallet', to: '/budgets', matches: ['/budgets'] },
  {
    label: 'Mais',
    icon: 'more_horiz',
    to: '/mais',
    matches: [
      '/mais',
      '/accounts',
      '/categories',
      '/transfers',
      '/recurrences',
      '/cards',
      '/debts',
      '/conta',
    ],
  },
];
const active = (item: (typeof primary)[number]) =>
  item.matches.some((path) => route.path === path || route.path.startsWith(`${path}/`));
const showGlobalAction = computed(() => primary.some((item) => active(item)));
async function create(type: 'INCOME' | 'EXPENSE') {
  choosingType.value = false;
  await router.push({ path: '/transactions', query: { create: type } });
}
</script>

<template>
  <div class="authenticated-shell">
    <header class="desktop-header" aria-label="Navegação principal">
      <router-link class="brand" to="/dashboard">PlannerFin</router-link>
      <nav>
        <router-link
          v-for="item in primary"
          :key="item.to"
          :to="item.to"
          :aria-current="active(item) ? 'page' : undefined"
          >{{ item.label }}</router-link
        >
      </nav>
      <button v-if="showGlobalAction" @click="choosingType = true">+ Novo lançamento</button>
    </header>
    <div class="shell-content"><slot /></div>
    <button
      v-if="showGlobalAction"
      class="global-fab"
      aria-label="Novo lançamento"
      @click="choosingType = true"
    >
      <span aria-hidden="true">+</span>
    </button>
    <nav class="bottom-nav" aria-label="Navegação principal">
      <router-link
        v-for="item in primary"
        :key="item.to"
        :to="item.to"
        :class="{ active: active(item) }"
        :aria-current="active(item) ? 'page' : undefined"
      >
        <span class="material-icons" aria-hidden="true">{{ item.icon }}</span
        ><span>{{ item.label }}</span>
      </router-link>
    </nav>
    <div
      v-if="choosingType"
      class="choice-backdrop"
      role="presentation"
      @click.self="choosingType = false"
    >
      <section
        class="choice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
      >
        <h2 id="new-transaction-title">Novo lançamento</h2>
        <p>O que você quer registrar?</p>
        <div>
          <button @click="create('INCOME')">Receita</button
          ><button @click="create('EXPENSE')">Despesa</button>
        </div>
        <button class="cancel" @click="choosingType = false">Cancelar</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.authenticated-shell {
  min-height: 100dvh;
  background: #f5f7fb;
}
.shell-content {
  width: 100%;
  min-width: 0;
}
.desktop-header {
  min-height: 4rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.6rem max(1.5rem, env(safe-area-inset-right)) 0.6rem
    max(1.5rem, env(safe-area-inset-left));
  background: #fff;
  border-bottom: 1px solid #dbe2ea;
}
.desktop-header nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}
.desktop-header a {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.8rem;
  color: #334155;
  text-decoration: none;
  border-radius: 0.6rem;
}
.desktop-header a[aria-current='page'] {
  color: #155eef;
  background: #eaf1ff;
  font-weight: 700;
}
.brand {
  font-weight: 800;
  color: #0f172a !important;
}
.bottom-nav,
.global-fab {
  display: none;
}
.choice-backdrop {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: #0f172a80;
}
.choice-dialog {
  width: min(100%, 24rem);
  padding: 1rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 1rem 3rem #0f172a40;
}
.choice-dialog h2 {
  margin-top: 0;
}
.choice-dialog div {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.choice-dialog .cancel {
  width: 100%;
  margin-top: 0.75rem;
  color: #334155;
  background: #e2e8f0;
}
@media (max-width: 767px) {
  .desktop-header {
    display: none;
  }
  .shell-content {
    min-height: 100dvh;
    padding: max(0.75rem, env(safe-area-inset-top))
      max(var(--mobile-gutter), env(safe-area-inset-right))
      calc(var(--shell-nav-height) + 5rem + env(safe-area-inset-bottom))
      max(var(--mobile-gutter), env(safe-area-inset-left));
  }
  .bottom-nav {
    position: fixed;
    z-index: 20;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    min-height: calc(var(--shell-nav-height) + env(safe-area-inset-bottom));
    padding: 0.25rem max(0px, env(safe-area-inset-right)) env(safe-area-inset-bottom)
      max(0px, env(safe-area-inset-left));
    background: #fff;
    border-top: 1px solid #cbd5e1;
  }
  .bottom-nav a {
    min-width: 0;
    min-height: 3.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    color: #475569;
    text-decoration: none;
    font-size: 0.75rem;
    border-radius: 0.75rem;
  }
  .bottom-nav a.active {
    color: #155eef;
    background: #eaf1ff;
    font-weight: 700;
  }
  .bottom-nav .material-icons {
    font-size: 1.45rem;
  }
  .global-fab {
    position: fixed;
    z-index: 21;
    right: max(1rem, env(safe-area-inset-right));
    bottom: calc(var(--shell-nav-height) + 1rem + env(safe-area-inset-bottom));
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    padding: 0;
    border-radius: 50%;
    box-shadow: 0 0.4rem 1rem #0f172a40;
    font-size: 2rem;
  }
  .choice-backdrop {
    align-items: end;
    padding: 0;
    padding-bottom: calc(var(--shell-nav-height) + env(safe-area-inset-bottom));
  }
  .choice-dialog {
    width: 100%;
    border-radius: 1rem 1rem 0 0;
    padding: 1rem max(1rem, env(safe-area-inset-right)) 1rem max(1rem, env(safe-area-inset-left));
  }
}
</style>
