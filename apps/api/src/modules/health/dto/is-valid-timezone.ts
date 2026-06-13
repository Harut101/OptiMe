import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsValidTimezone(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }

          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }
      }
    });
  };
}

