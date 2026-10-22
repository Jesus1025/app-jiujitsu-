# App Jiu-Jitsu

App para gestionar academias de Jiu-Jitsu: alumnos, asistencia, graduaciones, pagos y
comunicación. Funciona en **Android, iPhone y web**. Hecha con **Expo (React Native)** y
**Supabase**. Varias academias pueden usar la misma app; cada una solo ve sus datos.

El plan del producto, la hoja de ruta y cómo se probó están en [docs/PLAN.md](docs/PLAN.md).

## Qué hace

**Profesor / instructor**

- Panel: alumnos activos, asistencias e ingresos del mes, por cobrar, morosos.
- Alumnos: ficha completa (foto, RUT, emergencia, salud, experiencia), categoría por edad
  automática, historial de grados, exoneración firmada, PDF de la ficha, exportar a Excel,
  dar de baja conservando el historial, vincular cuentas a fichas ya cargadas.
- Aprobar o rechazar a quienes piden entrar (alumnos, apoderados, instructores).
- Clases: horario semanal, tomar asistencia con atrasos, QR de asistencia y enlace para
  sticker NFC.
- Pagos: planes y valores, mensualidades del mes (automáticas el día 1), cobros manuales,
  registrar pagos, morosos, descuento por referido.
- Graduación: requisitos por cinturón/grado y lista de candidatos.
- Ajustes propios de cada academia: logo y color, cinturones y grados, categorías, texto de
  la exoneración, días de gracia, matrícula automática, ventana del QR, quién otorga grados,
  si los alumnos ven el ranking y qué datos son obligatorios en la ficha.
- Eventos con inscripción y cobro, noticias y técnica de la semana (también en la web),
  documentos, pruebas con nota 1,0–7,0, tienda con inventario, cursos en video, muro.

**Alumno / apoderado**

- Completar la ficha y firmar la exoneración con el dedo (el apoderado, por cada hijo).
- Marcar asistencia escaneando el QR o acercando el teléfono al sticker NFC.
- Ver su progreso: cinturón, clases, barras hacia el próximo grado, puesto en el ranking.
- Pagos pendientes, calendario, noticias, pruebas, cursos, muro y notificaciones.

## Requisitos

- Node.js 22
- Docker (para correr Supabase en tu computador)
- Un teléfono con **Expo Go**, o un emulador Android / simulador iOS

## Correr en tu computador

```bash
npm install

# Supabase local (base de datos, login, archivos y correos de prueba)
npx supabase start            # muestra "API URL" y "Publishable key"

cp .env.example .env.local    # completa EXPO_PUBLIC_SUPABASE_URL y ..._PUBLISHABLE_KEY
                              # desde el teléfono usa la IP de tu computador, no 127.0.0.1

npx expo start                # escanea el QR con Expo Go; "w" abre la versión web
```

Los correos de prueba (códigos de confirmación y recuperación) se ven en Mailpit:
http://127.0.0.1:54324.

## Poner la app en producción

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (idealmente uno de prueba y
   otro de producción).
2. Sube la base de datos y la función de notificaciones:
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-del-proyecto>
   npx supabase db push
   npx supabase functions deploy send-push
   ```
3. **Authentication → Email Templates**: cambia _Confirm signup_ y _Reset password_ para
   que muestren el código `{{ .Token }}` (copia las de `supabase/templates/`). La app usa
   códigos de 6 dígitos, no enlaces.
4. Para el envío automático de notificaciones push, en el **SQL Editor** guarda estos dos
   secretos (la tarea programada los usa para llamar a `send-push` cada minuto):
   ```sql
   select vault.create_secret('https://<id-del-proyecto>.supabase.co', 'project_url');
   select vault.create_secret('<service_role key o secret key>', 'service_role_key');
   ```
5. Pon la URL y la publishable key del proyecto en `.env.local` (o en las variables de
   EAS para los builds).

Las tareas programadas (mensualidades el día 1, recordatorios de pago, cumpleaños,
resumen de morosos, recordatorios de eventos y pruebas automáticas) se crean solas con
`db push`.

### 2. Builds del teléfono (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                   # crea el proyecto en Expo
npx eas-cli@latest build -p android --profile preview      # APK para instalar y probar
npx eas-cli@latest build -p android --profile production   # para Google Play
```

- Las **notificaciones push** necesitan el proyecto de EAS (`eas init`) y un build propio:
  no funcionan dentro de Expo Go en Android.
- La cámara (QR y fotos), las firmas, los PDF y el resto funcionan también en Expo Go.

### 3. Versión web (opcional)

`npx expo export --platform web` genera la carpeta `dist/`, que se puede publicar en
cualquier hosting estático (con redirección de todas las rutas a `index.html`). Sirve para
que el profesor administre desde el computador.

### 4. Noticias en la página web

Ver [docs/WEB_NOTICIAS.md](docs/WEB_NOTICIAS.md).

## Pendiente (requiere decisiones o cuentas externas)

- **Pago en línea** (Flow, Mercado Pago o Webpay): necesita cuenta en la pasarela y estar
  en regla con el SII. Hoy los pagos se registran a mano (efectivo, transferencia, tarjeta).
- **Venta de cursos dentro de la app**: Apple y Google exigen su sistema de pagos para
  contenido digital. Hoy el profesor da acceso y el cobro queda en Pagos.
- Publicación en App Store y la revisión legal (términos, privacidad y la ley de datos
  personales).

## Comandos útiles

| Comando                               | Para qué sirve                                       |
| ------------------------------------- | ---------------------------------------------------- |
| `npm run typecheck`                   | Revisa los tipos de TypeScript                       |
| `npm run lint`                        | Revisa el código con ESLint                          |
| `npm run format`                      | Formatea el código con Prettier                      |
| `npx supabase test db`                | Corre las pruebas de la base de datos (pgTAP)        |
| `npx supabase db reset`               | Borra la base local y vuelve a aplicar todo          |
| `npx supabase migration new <nombre>` | Crea una migración nueva en `supabase/migrations/`   |
| `npm run db:types`                    | Regenera `src/types/database.ts` desde la base local |

## Estructura

```
src/app/          Pantallas (Expo Router): sin sesión, onboarding y academia (pestañas)
src/features/     Datos y lógica por módulo (alumnos, clases, pagos, comunidad, contenido…)
src/components/   Componentes de interfaz (ui/*, cinturón, firma, foto)
src/lib/          Supabase, sesión, formatos, archivos, RUT, alertas, navegación
supabase/         Migraciones SQL, pruebas pgTAP, Edge Function y plantillas de correo
docs/             Plan del producto y guía de noticias para la web
```
