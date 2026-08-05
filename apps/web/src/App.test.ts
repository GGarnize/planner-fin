import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import App from './App.vue';

vi.mock('./health', () => ({ fetchHealth: vi.fn(async () => 'available') }));

describe('App', () => {
  it('renderiza a página técnica e estado de carregamento inicial', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'q-layout': { template: '<div><slot /></div>' },
          'q-page-container': { template: '<div><slot /></div>' },
          'q-page': { template: '<div><slot /></div>' },
        },
      },
    });
    expect(wrapper.text()).toContain('PlannerFin');
    expect(wrapper.text()).toContain('Scaffold técnico inicial ativo.');
    expect(wrapper.text()).toContain('carregando');
  });
});
