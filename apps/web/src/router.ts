import { createRouter, createWebHistory } from 'vue-router';
import { authState, restore } from './auth';
import LoginPage from './pages/LoginPage.vue';
import RegisterPage from './pages/RegisterPage.vue';
import AccountPage from './pages/AccountPage.vue';
import AccountsPage from './pages/AccountsPage.vue';
import CategoriesPage from './pages/CategoriesPage.vue';
import TransactionsPage from './pages/TransactionsPage.vue';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/conta' },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/cadastro', component: RegisterPage, meta: { public: true } },
    { path: '/conta', component: AccountPage },
    { path: '/accounts', component: AccountsPage },
    { path: '/categories', component: CategoriesPage },
    { path: '/transactions', component: TransactionsPage },
  ],
});
let restored = false;
router.beforeEach(async (to) => {
  if (!restored) {
    restored = true;
    await restore();
  }
  if (!to.meta.public && !authState.token)
    return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.public && authState.token) return '/conta';
});
