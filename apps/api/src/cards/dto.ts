import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const MONEY = /^(?:[1-9][0-9]{0,16}(?:\.[0-9]{1,2})?|0\.(?:0[1-9]|[1-9][0-9]?))$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class CreateCardDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  issuer?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^\d{4}$/) last4?:
    string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(MONEY) creditLimit?:
    string | null;
  @IsInt() @Min(1) @Max(31) closingDay!: number;
  @IsInt() @Min(1) @Max(31) dueDay!: number;
}
export class UpdateCardDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  issuer?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^\d{4}$/) last4?:
    string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(MONEY) creditLimit?:
    string | null;
  @IsOptional() @IsInt() @Min(1) @Max(31) closingDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
}
