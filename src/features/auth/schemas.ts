import { z } from 'zod';

export const emailSchema = z.email('Ingresa un correo válido.');
export const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.');
export const otpSchema = z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(3, 'Ingresa tu nombre completo.'),
  email: emailSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({
  code: otpSchema,
  password: passwordSchema,
});

/** Devuelve el primer mensaje de error por campo, listo para mostrar en el formulario. */
export function fieldErrors<T extends z.ZodType>(schema: T, values: unknown) {
  const result = schema.safeParse(values);
  if (result.success)
    return { data: result.data as z.infer<T>, errors: {} as Record<string, string> };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}
