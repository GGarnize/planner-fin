import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateBy,
} from 'class-validator';
import { isCivilDate } from '../accounts/dto';
const MONEY = /^(0|[1-9][0-9]{0,16})\.[0-9]{2}$/,
  DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class CreateCardPurchaseDto {
  @IsUUID() cardId!: string;
  @IsUUID() categoryId!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) description!: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @IsString() @Matches(DATE) @IsCivilDate() purchaseDate!: string;
  @IsString() @Matches(MONEY) totalAmount!: string;
  @IsInt() @Min(1) @Max(36) installmentCount!: number;
}
export class UpdateCardPurchaseDto {
  @IsOptional() @IsUUID() cardId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) description?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @IsOptional() @IsString() @Matches(DATE) @IsCivilDate() purchaseDate?: string;
  @IsOptional() @IsString() @Matches(MONEY) totalAmount?: string;
  @IsOptional() @IsInt() @Min(1) @Max(36) installmentCount?: number;
}

export function IsCivilDate() {
  return ValidateBy({
    name: 'isCivilDate',
    validator: { validate: (value: unknown) => typeof value === 'string' && isCivilDate(value) },
  });
}
