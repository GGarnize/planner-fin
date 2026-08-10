import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './pages/LoginPage.vue';

const mocked = vi.hoisted(() => ({
  push: vi.fn(),
  query: {} as Record<string, string>,
  login: vi.fn(async () => undefined),
}));
vi.mock('./auth', () => ({ login: mocked.login }));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocked.push }),
  useRoute: () => ({ query: mocked.query }),
}));

async function submit(redirect?: string) {
  mocked.query = redirect ? { redirect } : {};
  const wrapper = mount(LoginPage, { global: { stubs: ['RouterLink'] } });
  await wrapper.get('input[type=email]').setValue('teste@example.com');
  await wrapper.get('input[type=password]').setValue('senha-ficticia');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('LoginPage', () => {
  beforeEach(() => {
    mocked.push.mockReset();
    mocked.login.mockClear();
  });
  it('segue para o dashboard sem redirect', async () => {
    await submit();
    expect(mocked.push).toHaveBeenCalledWith('/dashboard');
  });
  it('preserva um deep-link interno após login', async () => {
    await submit('/cards/card-id');
    expect(mocked.push).toHaveBeenCalledWith('/cards/card-id');
  });
});
