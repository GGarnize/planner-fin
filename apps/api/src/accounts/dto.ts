import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const TYPES = ['CHECKING', 'SAVINGS', 'CASH', 'PAYMENT', 'OTHER'] as const;
const MONEY = /^-?(0|[1-9][0-9]{0,16})(\.[0-9]{1,2})?$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export function isCivilDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

export class CreateAccountDto {
  @Transform(trim)
  @IsString({ message: 'Informe o nome da conta.' })
  @IsNotEmpty({ message: 'Informe o nome da conta.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres.' })
  name!: string;
  @IsIn(TYPES, { message: 'Selecione um tipo de conta válido.' }) type!: (typeof TYPES)[number];
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString({ message: 'Use de 1 a 120 caracteres para a instituição.' })
  @IsNotEmpty({ message: 'Use de 1 a 120 caracteres para a instituição.' })
  @MaxLength(120, { message: 'Use de 1 a 120 caracteres para a instituição.' })
  institution?: string | null;
  @IsIn(['BRL'], { message: 'A moeda deve ser BRL.' }) currency!: 'BRL';
  @IsString({
    message:
      'Informe um saldo entre -99999999999999999.99 e 99999999999999999.99, com até 2 casas decimais.',
  })
  @Matches(MONEY, {
    message:
      'Informe um saldo entre -99999999999999999.99 e 99999999999999999.99, com até 2 casas decimais.',
  })
  openingBalance!: string;
  @IsString({ message: 'Informe uma data de referência válida.' })
  @Matches(DATE, { message: 'Informe uma data de referência válida.' })
  openingBalanceDate!: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Informe o nome da conta.' })
  @IsNotEmpty({ message: 'Informe o nome da conta.' })
  @MaxLength(120, { message: 'Use no máximo 120 caracteres.' })
  name?: string;
  @IsOptional()
  @IsIn(TYPES, { message: 'Selecione um tipo de conta válido.' })
  type?: (typeof TYPES)[number];
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString({ message: 'Use de 1 a 120 caracteres para a instituição.' })
  @IsNotEmpty({ message: 'Use de 1 a 120 caracteres para a instituição.' })
  @MaxLength(120, { message: 'Use de 1 a 120 caracteres para a instituição.' })
  institution?: string | null;
  @IsOptional() @IsIn(['BRL'], { message: 'A moeda deve ser BRL.' }) currency?: 'BRL';
  @IsOptional()
  @IsString()
  @Matches(MONEY, {
    message:
      'Informe um saldo entre -99999999999999999.99 e 99999999999999999.99, com até 2 casas decimais.',
  })
  openingBalance?: string;
  @IsOptional()
  @IsString()
  @Matches(DATE, { message: 'Informe uma data de referência válida.' })
  openingBalanceDate?: string;
}
