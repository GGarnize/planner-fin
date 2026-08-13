import { Transform } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateImportDto {
  @IsIn(['OFX', 'CSV']) format!: 'OFX' | 'CSV';
  @IsUUID() accountId!: string;
  @IsOptional() @IsIn([',', ';', '\t']) delimiter?: ',' | ';' | '\t';
}

export class VersionDto {
  @IsInt() @Min(1) draftVersion!: number;
}

export class MappingDto extends VersionDto {
  @Allow()
  mapping!: unknown;
}

export class PatchImportRowDto extends VersionDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() amount?: string;
  @IsOptional() @IsIn(['INCOME', 'EXPENSE']) type?: 'INCOME' | 'EXPENSE';
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsBoolean() selected?: boolean;
  @IsOptional() @IsBoolean() probableOverride?: boolean;
  @IsOptional() @IsBoolean() possibleAccepted?: boolean;
}

export class ImportListQueryDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(200) limit = 100;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(0) offset = 0;
  @IsOptional() @IsIn(['all', 'valid', 'warning', 'duplicate', 'selected']) filter = 'all';
}

export class OpenImportsQueryDto {
  @IsIn(['open']) status!: 'open';
}

export class ConfirmImportDto extends VersionDto {
  @IsString() previewToken!: string;
}
