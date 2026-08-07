import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import {
  CivilDateConstraint,
  DescriptionConstraint,
  MoneyConstraint,
  NotesConstraint,
} from '../transactions/dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class CreateRecurrenceDto {
  @IsIn(['TRANSACTION', 'TRANSFER']) kind!: 'TRANSACTION' | 'TRANSFER';
  @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) frequency!: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  @ValidateIf((o) => o.frequency === 'WEEKLY') @IsInt() @Min(1) @Max(7) dayOfWeek?: number;
  @ValidateIf((o) => o.frequency !== 'WEEKLY') @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @ValidateIf((o) => o.frequency === 'YEARLY') @IsInt() @Min(1) @Max(12) monthOfYear?: number;
  @IsString() @Validate(CivilDateConstraint) startDate!: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Validate(CivilDateConstraint)
  endDate?: string | null;
  @ValidateIf((o) => o.kind === 'TRANSACTION') @IsIn(['INCOME', 'EXPENSE']) transactionType?:
    'INCOME' | 'EXPENSE';
  @ValidateIf((o) => o.kind === 'TRANSACTION') @IsUUID() accountId?: string;
  @ValidateIf((o) => o.kind === 'TRANSACTION') @IsUUID() categoryId?: string;
  @ValidateIf((o) => o.kind === 'TRANSFER') @IsUUID() sourceAccountId?: string;
  @ValidateIf((o) => o.kind === 'TRANSFER') @IsUUID() destinationAccountId?: string;
  @IsString() @Validate(MoneyConstraint) plannedAmount!: string;
  @Transform(trim) @IsString() @Validate(DescriptionConstraint) description!: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
}
export class UpdateRecurrenceDto {
  @IsOptional() @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  @IsOptional() @IsInt() @Min(1) @Max(7) dayOfWeek?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) monthOfYear?: number;
  @IsOptional() @IsString() @Validate(CivilDateConstraint) startDate?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Validate(CivilDateConstraint)
  endDate?: string | null;
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) transactionType?: 'INCOME' | 'EXPENSE';
  @IsOptional() @IsUUID() accountId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() sourceAccountId?: string;
  @IsOptional() @IsUUID() destinationAccountId?: string;
  @IsOptional() @IsString() @Validate(MoneyConstraint) plannedAmount?: string;
  @IsOptional() @Transform(trim) @IsString() @Validate(DescriptionConstraint) description?: string;
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
}
export class RecurrenceListDto {
  @IsOptional() @IsIn(['TRANSACTION', 'TRANSFER']) kind?: 'TRANSACTION' | 'TRANSFER';
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED']) status?: 'ACTIVE' | 'PAUSED';
  @IsOptional() @IsIn(['WEEKLY', 'MONTHLY', 'YEARLY']) frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
