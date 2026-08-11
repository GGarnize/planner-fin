import { Transform } from 'class-transformer';
import {
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
  DescriptionConstraint,
  MoneyConstraint,
  NotesConstraint,
  TRANSACTION_TYPES,
} from '../transactions/dto';
import { CategoryNameConstraint } from '../categories/dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class TemplateFieldsDto {
  @Transform(trim) @IsString() @Validate(CategoryNameConstraint) name!: string;
  @IsIn(TRANSACTION_TYPES) type!: (typeof TRANSACTION_TYPES)[number];
  @IsUUID() categoryId!: string;
  @Transform(trim) @IsString() @Validate(DescriptionConstraint) description!: string;
  @IsString() @Validate(MoneyConstraint) plannedAmount!: string;
  @IsOptional() @ValidateIf((_o, value) => value !== null) @IsUUID() defaultAccountId?:
    string | null;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
  @IsOptional() @ValidateIf((_o, value) => value !== null) @IsInt() @Min(1) @Max(31) dueDay?:
    number | null;
}
export class CreateTransactionTemplateDto extends TemplateFieldsDto {}
export class UpdateTransactionTemplateDto {
  @IsOptional() @Transform(trim) @IsString() @Validate(CategoryNameConstraint) name?: string;
  @IsOptional() @IsIn(TRANSACTION_TYPES) type?: (typeof TRANSACTION_TYPES)[number];
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Transform(trim) @IsString() @Validate(DescriptionConstraint) description?: string;
  @IsOptional() @IsString() @Validate(MoneyConstraint) plannedAmount?: string;
  @IsOptional() @ValidateIf((_o, value) => value !== null) @IsUUID() defaultAccountId?:
    string | null;
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Validate(NotesConstraint)
  notes?: string | null;
  @IsOptional() @ValidateIf((_o, value) => value !== null) @IsInt() @Min(1) @Max(31) dueDay?:
    number | null;
}
