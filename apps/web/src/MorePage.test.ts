import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MorePage from './pages/MorePage.vue';

vi.mock('./auth', () => ({ logout: vi.fn() }));
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return { ...actual, useRouter: () => ({ push: vi.fn() }) };
});

describe('MorePage', () => {
  it('renderiza chevrons como material-icons', () => {
    const wrapper = mount(MorePage, { global: { stubs: { RouterLink: RouterLinkStub } } });
    const chevrons = wrapper
      .findAll('.material-icons')
      .filter((icon) => icon.text() === 'chevron_right');
    expect(chevrons.length).toBeGreaterThan(0);
    expect(chevrons.every((icon) => icon.classes().includes('material-icons'))).toBe(true);
  });
});
