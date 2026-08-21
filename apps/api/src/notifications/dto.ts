import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import {
  CivilDateConstraint,
  DescriptionConstraint,
  MoneyConstraint,
  TRANSACTION_TYPES,
} from '../transactions/dto';

const PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class BindNotificationDeviceDto {
  @IsString()
  @Length(16, 80)
  @Matches(/^[A-Za-z0-9_-]+$/)
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @IsOptional()
  @IsBoolean()
  captureEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(PACKAGE_PATTERN, { each: true })
  monitoredPackages?: string[];

  @IsOptional()
  @IsBoolean()
  replacePreferences?: boolean;
}

export class UpdateNotificationDevicePreferencesDto {
  @IsOptional()
  @IsBoolean()
  captureEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(PACKAGE_PATTERN, { each: true })
  monitoredPackages?: string[];
}

export class CapturedNotificationIngestItemDto {
  @IsUUID()
  localId!: string;

  @IsString()
  @Matches(PACKAGE_PATTERN)
  packageName!: string;

  @IsString()
  @Matches(SHA256_PATTERN)
  notificationKeyHash!: string;

  @IsISO8601()
  postedAt!: string;

  @IsISO8601()
  capturedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bigText?: string | null;

  @Type(() => Number)
  @IsIn([1])
  fingerprintVersion!: 1;
}

export class IngestCapturedNotificationsDto {
  @IsString()
  @Length(16, 80)
  @Matches(/^[A-Za-z0-9_-]+$/)
  deviceId!: string;

  @IsUUID()
  ownerBindingId!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CapturedNotificationIngestItemDto)
  items!: CapturedNotificationIngestItemDto[];
}

export class ConfirmCapturedNotificationDto {
  @IsUUID()
  accountId!: string;

  @IsUUID()
  categoryId!: string;

  @IsIn(TRANSACTION_TYPES)
  type!: (typeof TRANSACTION_TYPES)[number];

  @IsString()
  @Validate(MoneyConstraint)
  amount!: string;

  @Transform(trim)
  @IsString()
  @Validate(DescriptionConstraint)
  description!: string;

  @IsString()
  @Validate(CivilDateConstraint)
  date!: string;
}
