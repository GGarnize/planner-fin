import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import KebabMenu from './components/KebabMenu.vue';

describe('KebabMenu', () => {
  it('abre ao clicar no gatilho e fecha ao selecionar uma ação', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(KebabMenu, {
      props: { actions: [{ label: 'Editar', onSelect }] },
      attachTo: document.body,
    });
    expect(wrapper.find('.kebab-panel').exists()).toBe(false);
    await wrapper.find('.kebab-trigger').trigger('click');
    expect(wrapper.find('.kebab-panel').exists()).toBe(true);
    await wrapper.find('.kebab-panel button').trigger('click');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(wrapper.find('.kebab-panel').exists()).toBe(false);
    wrapper.unmount();
  });

  it('fecha ao clicar fora e ao pressionar Escape', async () => {
    const wrapper = mount(KebabMenu, {
      props: { actions: [{ label: 'Excluir', onSelect: vi.fn(), danger: true }] },
      attachTo: document.body,
    });
    await wrapper.find('.kebab-trigger').trigger('click');
    expect(wrapper.find('.kebab-panel').exists()).toBe(true);
    document.body.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.kebab-panel').exists()).toBe(false);

    await wrapper.find('.kebab-trigger').trigger('click');
    expect(wrapper.find('.kebab-panel').exists()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.kebab-panel').exists()).toBe(false);
    wrapper.unmount();
  });

  it('marca a ação destrutiva com a classe danger', async () => {
    const wrapper = mount(KebabMenu, {
      props: { actions: [{ label: 'Excluir', onSelect: vi.fn(), danger: true }] },
      attachTo: document.body,
    });
    await wrapper.find('.kebab-trigger').trigger('click');
    expect(wrapper.find('.kebab-panel button').classes()).toContain('danger');
    wrapper.unmount();
  });
});
