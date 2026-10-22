// Traduce los errores más comunes de Supabase a mensajes para el usuario.
const messages: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Debes confirmar tu correo antes de entrar.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  otp_expired: 'El código expiró o no es válido. Pide uno nuevo.',
  over_email_send_rate_limit: 'Demasiados correos enviados. Espera unos minutos.',
  same_password: 'La nueva contraseña debe ser distinta a la anterior.',
};

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: string; message?: string };
    if (code && messages[code]) return messages[code];
    if (message) return message;
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
