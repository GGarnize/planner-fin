import { createRouter, createWebHistory } from 'vue-router';
import { authState, restore } from './auth';
import LoginPage from './pages/LoginPage.vue';
import RegisterPage from './pages/RegisterPage.vue';
import AccountPage from './pages/AccountPage.vue';
import AccountsPage from './pages/AccountsPage.vue';
import CategoriesPage from './pages/CategoriesPage.vue';
import TransactionsPage from './pages/TransactionsPage.vue';
import TransfersPage from './pages/TransfersPage.vue';
import RecurrencesPage from './pages/RecurrencesPage.vue';
import CardsPage from './pages/CardsPage.vue';
import DebtsPage from './pages/DebtsPage.vue';
import BudgetsPage from './pages/BudgetsPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import MorePage from './pages/MorePage.vue';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/cadastro', component: RegisterPage, meta: { public: true } },
    { path: '/conta', component: AccountPage },
    { path: '/accounts', component: AccountsPage },
    { path: '/categories', component: CategoriesPage },
    { path: '/transactions', component: TransactionsPage },
    { path: '/transfers', component: TransfersPage },
    { path: '/recurrences', component: RecurrencesPage },
    { path: '/cards', component: CardsPage },
    { path: '/cards/:id', component: CardsPage },
    { path: '/debts', component: DebtsPage },
    { path: '/debts/:id', component: DebtsPage },
    { path: '/budgets', component: BudgetsPage },
    { path: '/dashboard', component: DashboardPage },
    { path: '/mais', component: MorePage },
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
  if (to.meta.public && authState.token) return '/dashboard';
});
