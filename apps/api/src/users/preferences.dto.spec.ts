import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateUserPreferencesDto } from './preferences.dto';

async function fields(dto: UpdateUserPreferencesDto) {
  return (await validate(Object.assign(new UpdateUserPreferencesDto(), dto))).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

describe('UpdateUserPreferencesDto', () => {
  it('aceita somente enums aprovados', async () => {
    await expect(fields({ appearance: 'DARK', accent: 'TEAL' })).resolves.toEqual([]);
    await expect(fields({ appearance: 'AUTO' as never })).resolves.toContain('isIn');
    await expect(fields({ accent: '#155EEF' as never })).resolves.toContain('isIn');
    await expect(fields({ appearance: null as never })).resolves.toContain('isIn');
    await expect(fields({ accent: '' as never })).resolves.toContain('isIn');
  });
});
