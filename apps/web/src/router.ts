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
import TransactionFormPage from './pages/TransactionFormPage.vue';
import TransactionTemplatesPage from './pages/TransactionTemplatesPage.vue';
import InitialSetupPage from './pages/InitialSetupPage.vue';
import ImportPage from './pages/ImportPage.vue';
import NotificationListenerDevPage from './pages/NotificationListenerDevPage.vue';
import NotificationsPage from './pages/NotificationsPage.vue';
import NotificationsInboxPage from './pages/NotificationsInboxPage.vue';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.vue';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/cadastro', component: RegisterPage, meta: { public: true } },
    { path: '/privacy-policy', component: PrivacyPolicyPage, meta: { public: true } },
    { path: '/conta', component: AccountPage },
    { path: '/accounts', component: AccountsPage },
    { path: '/categories', component: CategoriesPage },
    { path: '/transactions', component: TransactionsPage },
    { path: '/transactions/new', component: TransactionFormPage },
    { path: '/transaction-templates', component: TransactionTemplatesPage },
    { path: '/transfers', component: TransfersPage },
    { path: '/recurrences', component: RecurrencesPage },
    { path: '/cards', component: CardsPage },
    { path: '/cards/:id', component: CardsPage },
    { path: '/debts', component: DebtsPage },
    { path: '/debts/:id', component: DebtsPage },
    { path: '/budgets', component: BudgetsPage },
    { path: '/dashboard', component: DashboardPage },
    { path: '/mais', component: MorePage },
    { path: '/imports', component: ImportPage },
    { path: '/imports/:id', component: ImportPage },
    { path: '/setup', component: InitialSetupPage },
    { path: '/notifications', component: NotificationsPage },
    { path: '/notifications/inbox', component: NotificationsInboxPage },
    { path: '/notifications/inbox/:id', component: NotificationsInboxPage },
    { path: '/dev/notification-listener', component: NotificationListenerDevPage },
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
