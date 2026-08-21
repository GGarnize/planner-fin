import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.vue';

describe('PrivacyPolicyPage', () => {
  it('renderiza a política pública com dados, retenção e contato', () => {
    const wrapper = mount(PrivacyPolicyPage);

    expect(wrapper.find('h1').text()).toBe('Política de Privacidade');
    expect(wrapper.text()).toContain('PlannerFin');
    expect(wrapper.text()).toContain('plannerfin.app@gmail.com');
    expect(wrapper.text()).toContain('dados financeiros');
    expect(wrapper.text()).toContain('captura por notificações');
    expect(wrapper.text()).toContain('Railway');
    expect(wrapper.text()).toContain('PostgreSQL');
    expect(wrapper.text()).toContain('90 dias');
    expect(wrapper.text()).toContain('7 dias');
    expect(wrapper.text()).toContain('30 dias');
    expect(wrapper.find('a[href="mailto:plannerfin.app@gmail.com"]').text()).toBe(
      'plannerfin.app@gmail.com',
    );
  });
});
