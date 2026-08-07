import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED'] as const;
export const MONEY_PATTERN = /^(?:0|[1-9][0-9]{0,16})\.[0-9]{1,2}$/;
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}
export function isMoney(value: unknown): value is string {
  return typeof value === 'string' && MONEY_PATTERN.test(value) && !/^0\.0{1,2}$/.test(value);
}
const control = (character: string) => {
  const code = character.codePointAt(0)!;
  return code <= 31 || (code >= 127 && code <= 159);
};
@ValidatorConstraint({ name: 'transferDescription' })
export class DescriptionConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return (
      typeof value === 'string' &&
      Array.from(value).length >= 1 &&
      Array.from(value).length <= 200 &&
      !Array.from(value).some(control)
    );
  }
  defaultMessage() {
    return 'Informe uma descrição entre 1 e 200 caracteres, sem quebras ou controles.';
  }
}
@ValidatorConstraint({ name: 'transferNotes' })
export class NotesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return (
      typeof value === 'string' &&
      Array.from(value).length <= 2000 &&
      !Array.from(value).some((c) => c !== '\n' && c !== '\r' && control(c))
    );
  }
  defaultMessage() {
    return 'Use no máximo 2.000 caracteres e remova caracteres de controle.';
  }
}
@ValidatorConstraint({ name: 'positiveMoney' })
export class MoneyConstraint implements ValidatorConstraintInterface {
  validate = isMoney;
  defaultMessage = () => 'Informe um valor decimal positivo.';
}
@ValidatorConstraint({ name: 'civilDate' })
export class CivilDateConstraint implements ValidatorConstraintInterface {
  validate = isCivilDate;
  defaultMessage = () => 'Informe uma data válida no formato YYYY-MM-DD.';
}

class RelationsDto {
  @IsUUID() sourceAccountId!: string;
  @IsUUID() destinationAccountId!: string;
}
export class CreateTransferDto extends RelationsDto {
  @IsIn(TRANSFER_STATUSES) status!: (typeof TRANSFER_STATUSES)[number];
  @Transform(trim) @IsString() @Validate(DescriptionConstraint) description!: string;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
  @IsString() @Validate(MoneyConstraint) plannedAmount!: string;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @Validate(MoneyConstraint)
  actualAmount?: string | null;
  @IsString() @Validate(CivilDateConstraint) dueDate!: string;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @Validate(CivilDateConstraint)
  completedAt?: string | null;
}
export class UpdateTransferDto {
  @IsOptional() @Transform(trim) @IsString() @Validate(DescriptionConstraint) description?: string;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
  @IsOptional() @IsString() @Validate(MoneyConstraint) plannedAmount?: string;
  @IsOptional() @IsString() @Validate(CivilDateConstraint) dueDate?: string;
  @IsOptional() @IsUUID() sourceAccountId?: string;
  @IsOptional() @IsUUID() destinationAccountId?: string;
}
export class CompleteTransferDto {
  @IsString() @Validate(MoneyConstraint) actualAmount!: string;
  @IsString() @Validate(CivilDateConstraint) completedAt!: string;
}
