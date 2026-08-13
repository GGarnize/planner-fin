import { IsIn, ValidateIf } from 'class-validator';

export const USER_APPEARANCES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
export const USER_ACCENTS = ['BLUE', 'TEAL', 'PURPLE', 'ORANGE'] as const;

export class UpdateUserPreferencesDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(USER_APPEARANCES, { message: 'Selecione uma aparencia valida.' })
  appearance?: (typeof USER_APPEARANCES)[number];

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(USER_ACCENTS, { message: 'Selecione uma cor de destaque valida.' })
  accent?: (typeof USER_ACCENTS)[number];
}
