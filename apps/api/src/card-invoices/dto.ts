import { IsString, IsUUID, Matches } from 'class-validator';
export class PayCardInvoiceDto {
  @IsUUID() accountId!: string;
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/) paymentDate!: string;
}
