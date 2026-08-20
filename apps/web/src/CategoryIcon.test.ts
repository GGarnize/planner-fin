import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CategoryIcon from './components/CategoryIcon.vue';
import {
  CATEGORY_ICON_MAP,
  materialCategoryIcon,
  validCategoryColor,
} from './category-icon';

describe('CategoryIcon', () => {
  it.each([
    ['HOME', 'home'],
    ['WORK', 'work'],
    ['SHOPPING_CART', 'shopping_cart'],
    ['RESTAURANT', 'restaurant'],
    ['DIRECTIONS_CAR', 'directions_car'],
    ['HEALTH_AND_SAFETY', 'health_and_safety'],
    ['SCHOOL', 'school'],
    ['SAVINGS', 'savings'],
  ] as const)('mapeia %s para %s', (icon, material) => {
    expect(CATEGORY_ICON_MAP[icon]).toBe(material);
    const wrapper = mount(CategoryIcon, { props: { icon, color: '#112233', label: icon } });
    expect(wrapper.get('.material-icons').text()).toBe(material);
  });

  it('usa fallback neutro para icon nulo', () => {
    const wrapper = mount(CategoryIcon, { props: { icon: null, color: null, label: 'Categoria' } });
    expect(materialCategoryIcon(null)).toBe('category');
    expect(wrapper.get('.material-icons').text()).toBe('category');
    expect(wrapper.classes()).toContain('category-icon--fallback');
  });

  it('valida cor somente no formato seguro #RRGGBB', () => {
    expect(validCategoryColor('#A1b2C3')).toBe(true);
    expect(validCategoryColor('red')).toBe(false);
    expect(validCategoryColor(null)).toBe(false);
  });
});
