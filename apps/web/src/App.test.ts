import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import App from './App.vue';
import LoginPage from './pages/LoginPage.vue';
describe('App', () =>
  it('renderiza login acessível', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: LoginPage }],
    });
    await router.push('/');
    await router.isReady();
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          'q-layout': { template: '<div><slot /></div>' },
          'q-page-container': { template: '<div><slot /></div>' },
          'q-page': { template: '<div><slot /></div>' },
        },
      },
    });
    expect(wrapper.get('h1').text()).toBe('Entrar');
    expect(wrapper.get('input[type=password]').attributes('autocomplete')).toBe('current-password');
  }));
