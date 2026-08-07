import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
export const CATEGORY_ICONS = [
  'HOME',
  'WORK',
  'SHOPPING_CART',
  'RESTAURANT',
  'DIRECTIONS_CAR',
  'HEALTH_AND_SAFETY',
  'SCHOOL',
  'SAVINGS',
] as const;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

@ValidatorConstraint({ name: 'categoryName' })
export class CategoryNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const size = Array.from(value).length;
    return (
      size >= 1 &&
      size <= 80 &&
      !Array.from(value).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 31 || (code >= 127 && code <= 159);
      })
    );
  }
  defaultMessage(): string {
    return 'Informe um nome entre 1 e 80 caracteres, sem caracteres de controle.';
  }
}
class CategoryVisualDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Use uma cor no formato #RRGGBB.' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Use uma cor no formato #RRGGBB.' })
  color?: string | null;

  @IsOptional()
  @IsIn(CATEGORY_ICONS, { message: 'Selecione um ícone suportado.' })
  icon?: (typeof CATEGORY_ICONS)[number] | null;
}
export class CreateCategoryDto extends CategoryVisualDto {
  @Transform(trim)
  @IsString({ message: 'Informe um nome entre 1 e 80 caracteres.' })
  @Validate(CategoryNameConstraint)
  name!: string;
  @IsIn(CATEGORY_TYPES, { message: 'Selecione receita ou despesa.' })
  type!: (typeof CATEGORY_TYPES)[number];
}
export class UpdateCategoryDto extends CategoryVisualDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Informe um nome entre 1 e 80 caracteres.' })
  @Validate(CategoryNameConstraint)
  name?: string;
}
