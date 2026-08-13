import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TYPES as ACCOUNT_TYPES, isCivilDate } from '../accounts/dto';
import { CATEGORY_ICONS, CATEGORY_TYPES, CategoryNameConstraint } from '../categories/dto';
import { Validate } from 'class-validator';

const MONEY = /^-?(0|[1-9][0-9]{0,16})(\.[0-9]{1,2})?$/;
const STEPS = ['INTRO', 'ACCOUNT', 'CATEGORIES', 'REVIEW'] as const;

export class InitialSetupAccountDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(ACCOUNT_TYPES)
  type!: (typeof ACCOUNT_TYPES)[number];

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  openingBalance?: string | null;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  openingBalanceDate!: string;
}

export class InitialSetupCategoryDto {
  @IsString()
  @MaxLength(40)
  key!: string;

  @IsString()
  @Validate(CategoryNameConstraint)
  name!: string;

  @IsIn(CATEGORY_TYPES)
  type!: (typeof CATEGORY_TYPES)[number];

  @IsIn(CATEGORY_ICONS)
  icon!: (typeof CATEGORY_ICONS)[number];

  @IsBoolean()
  selected!: boolean;
}

export class InitialSetupDraftDto {
  @IsIn(STEPS)
  step!: (typeof STEPS)[number];

  @ValidateNested()
  @Type(() => InitialSetupAccountDto)
  account!: InitialSetupAccountDto;

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => InitialSetupCategoryDto)
  categories!: InitialSetupCategoryDto[];
}

export class SaveInitialSetupDraftDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  expectedDraftVersion!: number | null;

  @ValidateNested()
  @Type(() => InitialSetupDraftDto)
  draft!: InitialSetupDraftDto;
}

export class InitialSetupPreviewDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  draftVersion!: number;
}

export function assertCivilDate(value: string): void {
  if (!isCivilDate(value)) throw new Error('INVALID_CIVIL_DATE');
}
