import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { passwordIsValid } from './auth.utils';
import { registerDecorator } from 'class-validator';

function IsStrongPassword() {
  return (object: object, propertyName: string): void =>
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && passwordIsValid(value),
        defaultMessage: () => 'Use de 10 a 128 caracteres, com pelo menos uma letra e um número.',
      },
    });
}

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe seu nome.' })
  @MinLength(1, { message: 'Informe seu nome.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLocaleLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'Informe um e-mail válido.' })
  email!: string;
  @IsString() @IsStrongPassword() password!: string;
}
export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLocaleLowerCase() : value))
  @IsEmail({}, { message: 'E-mail ou senha inválidos.' })
  @MaxLength(254)
  email!: string;
  @IsString({ message: 'E-mail ou senha inválidos.' })
  @MinLength(1, { message: 'E-mail ou senha inválidos.' })
  @MaxLength(128, { message: 'E-mail ou senha inválidos.' })
  password!: string;
}
export class EmptyDto {}
