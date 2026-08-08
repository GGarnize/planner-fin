import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
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
  ValidateNested,
} from 'class-validator';
const TYPES = ['LOAN', 'FINANCING', 'NEGOTIATED_DEBT', 'OTHER'] as const;
export const MONEY_POSITIVE = /^(?:0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,16}\.[0-9]{2})$/;
export const MONEY_NON_NEGATIVE = /^(?:0\.00|0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,16}\.[0-9]{2})$/;
export const CIVIL_DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class DebtInstallmentDto {
  @IsInt() @Min(1) @Max(600) installmentNumber!: number;
  @IsString() @Matches(CIVIL_DATE) dueDate!: string;
  @IsString() @Matches(MONEY_POSITIVE) principalAmount!: string;
  @IsString() @Matches(MONEY_NON_NEGATIVE) interestAmount!: string;
  @IsString() @Matches(MONEY_NON_NEGATIVE) feeAmount!: string;
}
export class DebtFundingDto {
  @IsUUID() accountId!: string;
  @IsString() @Matches(MONEY_POSITIVE) amount!: string;
  @IsString() @Matches(CIVIL_DATE) fundingDate!: string;
}
export class CreateDebtDto {
  @IsIn(TYPES) type!: (typeof TYPES)[number];
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) creditorName!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @IsString() @Matches(MONEY_POSITIVE) originalPrincipal!: string;
  @IsString() @Matches(CIVIL_DATE) startDate!: string;
  @IsInt() @Min(1) @Max(600) installmentCount!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(600)
  @ValidateNested({ each: true })
  @Type(() => DebtInstallmentDto)
  installments!: DebtInstallmentDto[];
  @IsOptional() @ValidateNested() @Type(() => DebtFundingDto) funding?: DebtFundingDto;
}
export class UpdateDebtDto {
  @IsOptional() @IsIn(TYPES) type?: (typeof TYPES)[number];
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) creditorName?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
  @IsOptional() @IsString() @Matches(MONEY_POSITIVE) originalPrincipal?: string;
  @IsOptional() @IsString() @Matches(CIVIL_DATE) startDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(600) installmentCount?: number;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(600)
  @ValidateNested({ each: true })
  @Type(() => DebtInstallmentDto)
  installments?: DebtInstallmentDto[];
  @IsOptional() @ValidateNested() @Type(() => DebtFundingDto) funding?: DebtFundingDto;
}
export class PayDebtInstallmentDto {
  @IsUUID() accountId!: string;
  @IsString() @Matches(CIVIL_DATE) paymentDate!: string;
}
