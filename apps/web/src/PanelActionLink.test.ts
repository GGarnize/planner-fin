import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import PanelActionLink from './components/PanelActionLink.vue';

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' };

describe('PanelActionLink', () => {
  it('expõe label, destino e semântica de link', () => {
    const wrapper = mount(PanelActionLink, {
      props: { to: '/budgets', icon: 'account_balance_wallet', label: 'Ver Orçamento' },
      global: { stubs: { RouterLink } },
    });

    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('/budgets');
    expect(link.text()).toContain('Ver Orçamento');
    expect(link.text()).toContain('chevron_right');
  });

  it('tem foco visível e usa tokens em vez de branco hardcoded', () => {
    const styles = readFileSync('src/components/PanelActionLink.vue', 'utf8');

    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('var(--color-accent-container)');
    expect(styles).not.toMatch(/background:\s*(white|#fff|#ffffff)/i);
  });

  it('suporta variante compacta', () => {
    const wrapper = mount(PanelActionLink, {
      props: { to: '/cards', label: 'Cartões', compact: true },
      global: { stubs: { RouterLink } },
    });

    expect(wrapper.classes()).toContain('panel-action-link--compact');
  });
});
