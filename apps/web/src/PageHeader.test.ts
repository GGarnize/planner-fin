import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import PageHeader from './components/PageHeader.vue';

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' };

describe('PageHeader', () => {
  it('renderiza destino de topo sem Up', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Início', description: 'Resumo financeiro.' },
      global: { stubs: { RouterLink } },
    });

    expect(wrapper.get('h1').text()).toBe('Início');
    expect(wrapper.text()).toContain('Resumo financeiro.');
    expect(wrapper.find('[aria-label="Voltar"]').exists()).toBe(false);
  });

  it('renderiza página secundária com Up icon-only e destino correto', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Contas', backTo: '/conta' },
      global: { stubs: { RouterLink } },
    });

    const up = wrapper.get('[aria-label="Voltar"]');
    expect(up.attributes('href')).toBe('/conta');
    expect(up.text()).toBe('arrow_back');
    expect(up.text()).not.toContain('Minha conta');
  });

  it('renderiza slot de ação sem branco hardcoded', () => {
    const wrapper = mount(PageHeader, {
      props: { title: 'Modelos', backTo: '/mais' },
      slots: { action: '<button>Novo modelo</button>' },
      global: { stubs: { RouterLink } },
    });

    expect(wrapper.get('button').text()).toBe('Novo modelo');
    const styles = readFileSync('src/components/PageHeader.vue', 'utf8');
    expect(styles).not.toMatch(/background:\s*(white|#fff|#ffffff)/i);
  });
});
