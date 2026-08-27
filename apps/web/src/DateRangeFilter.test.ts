import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DateRangeFilter from './components/DateRangeFilter.vue';

describe('DateRangeFilter', () => {
  it('renderiza fieldset, legend e labels associados sem depender de placeholder', () => {
    const wrapper = mount(DateRangeFilter, {
      props: {
        from: '2026-08-01',
        to: '2026-08-31',
        label: 'Período de vencimento',
        fromLabel: 'Início',
        toLabel: 'Fim',
      },
    });

    expect(wrapper.get('legend').text()).toBe('Período de vencimento');
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['Início', 'Fim']);
    expect(wrapper.findAll('input').map((input) => input.attributes('placeholder'))).toEqual([
      undefined,
      undefined,
    ]);
    expect(
      wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).value),
    ).toEqual(['2026-08-01', '2026-08-31']);
  });

  it('emite from e to independentemente', async () => {
    const wrapper = mount(DateRangeFilter, { props: { from: '', to: '' } });
    const inputs = wrapper.findAll('input');

    await inputs[0]!.setValue('2026-09-01');
    await inputs[1]!.setValue('2026-09-30');

    expect(wrapper.emitted('update:from')).toEqual([['2026-09-01']]);
    expect(wrapper.emitted('update:to')).toEqual([['2026-09-30']]);
  });

  it('desabilita o grupo e os dois campos', () => {
    const wrapper = mount(DateRangeFilter, { props: { from: '', to: '', disabled: true } });

    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
    expect(
      wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined),
    ).toBe(true);
  });
});
