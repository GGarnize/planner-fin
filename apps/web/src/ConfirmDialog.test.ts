import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './components/ConfirmDialog.vue';

describe('ConfirmDialog', () => {
  it('não renderiza quando fechado', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: false, title: 'Arquivar?', message: 'Tem certeza?' },
    });
    expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
  });

  it('emite confirm e cancel ao clicar nos botões', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: 'Arquivar categoria?', message: 'Tem certeza?' },
    });
    expect(wrapper.get('h2').text()).toBe('Arquivar categoria?');
    await wrapper.get('.danger').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    await wrapper.get('.secondary').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('desabilita os botões enquanto busy', () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: 'x', message: 'y', busy: true },
    });
    expect(wrapper.get('.danger').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.secondary').attributes('disabled')).toBeDefined();
  });

  it('fecha ao clicar fora (backdrop)', async () => {
    const onCancel = vi.fn();
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: 'x', message: 'y' },
      attrs: { onCancel },
    });
    await wrapper.get('.confirm-backdrop').trigger('click');
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
