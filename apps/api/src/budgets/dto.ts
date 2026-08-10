import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MONTH_PATTERN } from './budget-finance';

const MONEY = /^(?:0|[1-9][0-9]{0,16})\.[0-9]{2}$/;
export class BudgetCategoryDto {
  @IsUUID('4') categoryId!: string;
  @IsString() @Matches(MONEY) limitAmount!: string;
}
export class CreateBudgetDto {
  @IsString() @Matches(MONTH_PATTERN) month!: string;
  @IsString() @Matches(MONEY) totalLimit!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categories!: BudgetCategoryDto[];
}
export class UpdateBudgetDto {
  @IsOptional() @IsString() @Matches(MONEY) totalLimit?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryDto)
  categories?: BudgetCategoryDto[];
}
export class CopyBudgetDto {
  @IsString() @Matches(MONTH_PATTERN) targetMonth!: string;
}
