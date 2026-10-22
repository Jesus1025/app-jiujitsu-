# App Jiu-Jitsu

App móvil para gestionar academias de Jiu-Jitsu: alumnos, asistencia, graduaciones,
pagos y comunicación. Hecha con **Expo (React Native)** y **Supabase**.

El plan completo del producto y del desarrollo está en [docs/PLAN.md](docs/PLAN.md).

## Qué funciona hoy

- Crear cuenta (con código de 6 dígitos enviado por correo), iniciar sesión y recuperar
  la contraseña.
- Crear una academia: quien la crea queda como dueño y se cargan las categorías por edad y
  los cinturones de Jiu-Jitsu (adulto y kids).
- Unirse a una academia con su código como alumno, apoderado o instructor.
- El dueño (y los instructores, para alumnos) aprueba o rechaza las solicitudes.
- Cada academia solo ve sus propios datos (Row Level Security, con pruebas automáticas).

## Requisitos

- Node.js 22
- Docker (para correr Supabase en tu computador)
- La app **Expo Go** en tu teléfono, o un emulador Android / simulador iOS

## Cómo correrlo

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar Supabase local (base de datos, autenticación, correos de prueba)
npx supabase start
#    Al terminar muestra "API URL" y "Publishable key" (o "anon key").

# 3. Configurar las variables de entorno
cp .env.example .env.local
#    Completa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
#    Si pruebas desde el teléfono, usa la IP de tu computador en vez de 127.0.0.1.

# 4. Abrir la app
npx expo start
#    Escanea el QR con Expo Go (Android) o con la cámara (iPhone).
```

En local, los correos (códigos de confirmación y recuperación) no se envían de verdad:
se ven en Mailpit, en http://127.0.0.1:54324.

## Comandos útiles

| Comando                               | Para qué sirve                                                    |
| ------------------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`                   | Revisa los tipos de TypeScript                                    |
| `npm run lint`                        | Revisa el código con ESLint                                       |
| `npm run format`                      | Formatea el código con Prettier                                   |
| `npx supabase test db`                | Corre las pruebas de la base de datos (seguridad entre academias) |
| `npx supabase db reset`               | Borra la base local y vuelve a aplicar migraciones y `seed.sql`   |
| `npx supabase migration new <nombre>` | Crea una migración nueva en `supabase/migrations/`                |
| `npm run db:types`                    | Regenera `src/types/database.ts` desde la base local              |

## Publicar en Supabase (nube)

1. Crea un proyecto en [supabase.com](https://supabase.com) (idealmente uno **dev** y uno **prod**).
2. Vincúlalo y sube las migraciones:
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-del-proyecto>
   npx supabase db push
   ```
3. En **Authentication → Email Templates**, cambia las plantillas _Confirm signup_ y
   _Reset password_ para que muestren el código `{{ .Token }}` (puedes copiar las de
   `supabase/templates/`). La app usa códigos de 6 dígitos, no enlaces.
4. Pon la URL y la publishable key del proyecto en `.env.local`.

## Estructura

```
src/app/          Pantallas (Expo Router)
src/components/   Componentes de interfaz
src/features/     Lógica por módulo (consultas a Supabase, validaciones)
src/lib/          Cliente de Supabase, sesión, manejo de errores
supabase/         Migraciones SQL, pruebas, plantillas de correo y configuración
docs/PLAN.md      Plan del producto y hoja de ruta
```
