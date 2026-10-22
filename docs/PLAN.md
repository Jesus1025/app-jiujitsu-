# Plan de la app — Gestión de academias de Jiu-Jitsu

> Basado en los requisitos que envió el profesor en audios de WhatsApp (21-10-2026).
> Documento vivo: actualizar a medida que se tomen decisiones.

## Índice

1. [Visión del producto](#1-visión-del-producto)
2. [Usuarios y roles](#2-usuarios-y-roles)
3. [Funcionalidades (catálogo completo)](#3-funcionalidades-catálogo-completo)
4. [Arquitectura y tecnologías](#4-arquitectura-y-tecnologías)
5. [Multi-academia (multi-tenant)](#5-multi-academia-multi-tenant)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Pantallas por rol](#7-pantallas-por-rol)
8. [Flujos clave](#8-flujos-clave)
9. [Notificaciones automáticas](#9-notificaciones-automáticas)
10. [Seguridad, privacidad y legal](#10-seguridad-privacidad-y-legal)
11. [Fases de desarrollo (roadmap)](#11-fases-de-desarrollo-roadmap)
12. [Estructura del repositorio](#12-estructura-del-repositorio)
13. [Primeros pasos para empezar a programar](#13-primeros-pasos-para-empezar-a-programar)
14. [Preguntas abiertas para el profesor](#14-preguntas-abiertas-para-el-profesor)
15. [Riesgos y cómo mitigarlos](#15-riesgos-y-cómo-mitigarlos)

---

## 1. Visión del producto

Una app móvil para que **academias de Jiu-Jitsu** (y más adelante otras artes marciales)
gestionen alumnos, asistencia, graduaciones, pagos y comunicación, reemplazando el papel
y el Excel.

- **SaaS multi-academia**: cada profesor crea su academia dentro de la app; cada academia
  ve solo sus datos.
- **Especializada en artes marciales**, no un gestor genérico de gimnasios. Lo que la
  diferencia: cinturones, grados, tiempo y requisitos de graduación, categorías por edad,
  linaje, exoneración de responsabilidad para menores.
- **Configurable**: cinturones, grados, categorías y requisitos se definen por academia
  (con una plantilla de Jiu-Jitsu por defecto), para poder sumar judo, karate o MMA sin
  reescribir código.
- **Primer cliente (piloto)**: la academia del profesor. Se valida ahí antes de abrirla a
  otras academias.
- **Modelo de negocio futuro**: plan **Básico** (gestión) y plan **Premium** (cobros en
  línea, cursos en video, etc.).

### Objetivos medibles del piloto

- 100 % de los alumnos activos registrados con ficha completa.
- Asistencia registrada en la app en todas las clases durante 1 mes.
- El profesor deja de usar papel/Excel para deudas y graduaciones.

---

## 2. Usuarios y roles

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Dueño** (`owner`) | Profesor que crea la academia | Todo: configurar academia, aprobar alumnos, cobros, grados, contenido, invitar instructores |
| **Instructor** (`instructor`) | Otro profe o ayudante (ej. "mi profe") | Tomar asistencia, ver fichas, otorgar grados (si el dueño lo permite), publicar técnica de la semana |
| **Alumno** (`student`) | Adulto que entrena | Ver su perfil, progreso, deuda, calendario, documentos, marcar asistencia, responder tests |
| **Apoderado** (`guardian`) | Padre/madre de un menor | Registrar y gestionar a uno o varios hijos, firmar exoneración, ver pagos y asistencia de sus hijos |

Una misma persona puede tener roles distintos en academias distintas (ej. instructor en una
y alumno en otra), por eso el rol vive en la **membresía**, no en el usuario.

---

## 3. Funcionalidades (catálogo completo)

Prioridad: **P1** = MVP del piloto · **P2** = segunda etapa · **P3** = después / premium.

### 3.1 Cuentas y acceso
| Funcionalidad | Prioridad |
|---|---|
| Registro e inicio de sesión (email + contraseña; luego Google/Apple) | P1 |
| Crear academia (nombre, logo, colores) | P1 |
| Unirse a una academia con código o enlace de invitación | P1 |
| **El profesor aprueba o rechaza** cada solicitud (no entra cualquiera) | P1 |
| Invitar instructores | P1 |
| Apoderado registra a hijos menores | P1 |
| Dar de baja a un alumno conservando el historial (fecha y motivo de salida) | P1 |
| Eliminar definitivamente un alumno (con confirmación) | P2 |

### 3.2 Ficha del alumno
| Funcionalidad | Prioridad |
|---|---|
| Datos personales: nombre, RUT (opcional), fecha de nacimiento, teléfono, contacto de emergencia, datos médicos relevantes | P1 |
| **Foto obligatoria** al registrarse | P1 |
| ¿Entrenaba antes? (dónde, cuánto tiempo, cinturón previo) | P1 |
| **Categoría por edad** asignada automáticamente según fecha de nacimiento | P1 |
| Tiempo exacto entrenando desde el ingreso | P1 |
| Historial de cinturones y grados con fecha y quién los otorgó | P1 |
| Fichas editables por el profesor | P1 |
| **Descargar ficha en PDF** (individual) y lista de alumnos en Excel/CSV | P1 |

Categorías por defecto (según el profesor, editables):

| Categoría | Edad |
|---|---|
| Infantil / Kids | 4 a 8 |
| Juvenil 1 | 9 a 14 |
| Juvenil 2 | 15 a 17 |
| Adulto | 18+ |

### 3.3 Exoneración de responsabilidad
| Funcionalidad | Prioridad |
|---|---|
| Texto de exoneración editable por la academia (con versiones) | P1 |
| **Firma con el dedo** en pantalla (adulto o apoderado si es menor) | P1 |
| Se genera un PDF firmado con fecha y hora y queda guardado en la ficha | P1 |
| Si cambia el texto, pedir firma nueva | P2 |

### 3.4 Clases, horario y asistencia
| Funcionalidad | Prioridad |
|---|---|
| Horario semanal de clases (día, hora, categoría, instructor) | P1 |
| Asistencia manual por el profesor (lista con checks) | P1 |
| **Auto check-in del alumno** escaneando un código QR en la academia | P1 |
| Check-in con **sticker NFC** (el sticker abre el mismo enlace del QR) | P2 |
| Marcar **atrasos** (automático según hora de check-in, o manual) | P1 |
| Contador de clases por alumno | P1 |
| **Técnica de la semana**: publicación + notificación el lunes | P2 |
| Clases canceladas / feriados | P2 |

### 3.5 Graduación
| Funcionalidad | Prioridad |
|---|---|
| Sistema de cinturones configurable (plantilla IBJJF adulto y kids por defecto) | P1 |
| Otorgar cinturón o grado y registrar fecha | P1 |
| **Programa de graduación propio**: requisitos por cinturón (mín. clases, mín. meses, checklist de técnicas, etc.) | P2 |
| Barra de progreso hacia el siguiente grado (para el alumno y el profesor) | P2 |
| Lista "candidatos a graduarse" para el profesor | P2 |

### 3.6 Pagos y deudas
| Funcionalidad | Prioridad |
|---|---|
| Planes y valores: matrícula, mensualidad (con día de vencimiento) | P1 |
| Generación automática de la mensualidad cada mes | P1 |
| Registrar pagos manuales (efectivo, transferencia) | P1 |
| Ver **quién está atrasado, cuánto debe y cuántos meses** | P1 |
| **Recordatorios de pago** automáticos (antes del vencimiento y en atraso) | P1 |
| Descuentos y promociones (ej. referido: media mensualidad al que trae un alumno nuevo) | P2 |
| **Pasarela de pago** en línea (Flow / Mercado Pago / Webpay) | P3 (Premium) |

### 3.7 Calendario, noticias y notificaciones
| Funcionalidad | Prioridad |
|---|---|
| Notificaciones push | P1 |
| **Calendario editable**: graduaciones, seminarios, masterclasses, competencias | P2 |
| Recordatorio semanal de fechas importantes (ej. "Graduación el 5 de diciembre") | P2 |
| Eventos con cobro (seminario con valor → genera cargo) | P2 |
| **Noticias / anuncios** de la academia (ofertas, competencias) | P2 |
| Las noticias también se muestran en la **página web** de la academia | P3 |
| Recordatorios para el profesor (pagos por revisar, solicitudes pendientes, cumpleaños) | P2 |

### 3.8 Contenido y comunidad
| Funcionalidad | Prioridad |
|---|---|
| Documentos descargables: reglamento, manual del alumno nuevo, etc. | P2 |
| **Tests / pruebas** (opción múltiple) enviados al alumno, con nota registrada; no afectan la graduación | P3 |
| Envío automático de un test a los X meses de ingreso | P3 |
| **Ranking** dentro de la academia (mejor asistencia del mes / año) | P2 |
| Muro / blog de comentarios y testimonios | P3 |
| **Cursos en video pagados**, solo para ver dentro de la app | P3 (Premium) |

### 3.9 Extras del profesor
| Funcionalidad | Prioridad |
|---|---|
| Inventario de productos (parches, poleras, kimonos) con precio y stock | P3 |
| Registrar ventas (descuenta stock y puede generar cargo al alumno) | P3 |
| Panel con resumen: alumnos activos, asistencia del mes, ingresos, deudas | P2 |

### 3.10 SaaS comercial
| Funcionalidad | Prioridad |
|---|---|
| Alta autónoma de nuevas academias | P3 |
| Planes Básico / Premium y cobro de suscripción a las academias | P3 |
| Personalización por academia: logo, colores, textos | P2 |

---

## 4. Arquitectura y tecnologías

### Decisión recomendada

| Capa | Tecnología | Por qué |
|---|---|---|
| App móvil | **React Native + Expo** (TypeScript) | Un solo código para Android y iOS; Expo simplifica builds, notificaciones y publicación en tiendas |
| Navegación | **Expo Router** | Rutas por archivos; también permite una versión web más adelante |
| Backend | **Supabase** | Postgres + autenticación + almacenamiento de archivos + funciones; plan gratis suficiente para el piloto |
| Aislamiento entre academias | **Row Level Security (RLS)** de Postgres | Cada consulta solo ve datos de las academias del usuario, garantizado por la base de datos |
| Lógica de servidor | **Supabase Edge Functions** + **pg_cron** | Generar mensualidades, enviar recordatorios, generar PDFs |
| Notificaciones push | **Expo Notifications** (Expo Push API) | Un solo servicio para Android e iOS |
| Datos y caché en la app | **TanStack Query** | Caché, reintentos y estados de carga sin código repetido |
| Formularios | **React Hook Form + Zod** | Validación de fichas y formularios largos |
| UI | **Tamagui** o **NativeWind** (Tailwind) | Componentes rápidos de construir y con tema por academia |
| Firma con el dedo | `react-native-signature-canvas` | Captura la firma como imagen |
| Escaneo QR | `expo-camera` | Lector QR integrado |
| PDF | `expo-print` (HTML → PDF) en la app; `pdf-lib` en Edge Functions para PDFs firmados | |
| Video (fase 3) | **Mux** o **Cloudflare Stream** con URLs firmadas | Streaming sin enlace descargable directo |
| Pagos (fase 3) | **Flow** o **Mercado Pago** (Chile) | Webpay, tarjetas y transferencias |
| Errores y métricas | **Sentry** | Ver errores reales de los usuarios |
| Builds y publicación | **EAS Build / EAS Submit** | Compila y sube a Play Store / App Store |

### Diagrama general

```
┌──────────────────────┐         ┌──────────────────────────────────────┐
│  App Expo (Android / │  HTTPS  │              Supabase                │
│  iOS) — roles:       │◄───────►│  Auth · Postgres (RLS) · Storage     │
│  dueño, instructor,  │         │  Edge Functions · pg_cron            │
│  alumno, apoderado   │         └───────┬──────────────────┬───────────┘
└──────────▲───────────┘                 │                  │
           │ push                        │                  │ (fase 3)
┌──────────┴───────────┐                 │         ┌────────▼─────────┐
│   Expo Push API      │◄────────────────┘         │ Flow / Mercado   │
└──────────────────────┘                           │ Pago · Mux       │
                                                   └──────────────────┘
```

### Por qué no "un servidor por academia"

El profesor sugirió que cada escuela tenga su propio servidor. Es más simple y barato usar
**una sola base de datos** donde cada fila lleva el `academy_id` y las políticas RLS impiden
que una academia vea datos de otra. Un servidor por academia multiplica costos, migraciones
y mantenimiento sin agregar seguridad real. Si en el futuro una academia grande lo exige,
se puede migrar a ella sola.

### Alternativa considerada

**Flutter + Firebase**: también válida. Se descarta porque Firestore (NoSQL) complica los
reportes (deudas, asistencia por mes, rankings) que en SQL son consultas simples.

---

## 5. Multi-academia (multi-tenant)

- Toda tabla de negocio tiene `academy_id`.
- Tabla `memberships` une usuario ↔ academia ↔ rol ↔ estado.
- Funciones SQL auxiliares usadas por las políticas RLS:

```sql
-- ¿El usuario actual pertenece (activo) a la academia con alguno de estos roles?
create function public.has_role(p_academy uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.academy_id = p_academy
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;
```

```sql
-- Ejemplo: alumnos visibles para el staff de su academia, o para sí mismo / su apoderado
create policy "ver alumnos" on students for select using (
  has_role(academy_id, array['owner','instructor'])
  or user_id = auth.uid()
  or guardian_user_id = auth.uid()
);
```

- Archivos (fotos, PDFs, firmas) en buckets **privados** con ruta
  `academy/{academy_id}/...`, y políticas de Storage con la misma regla.
- **Tests automáticos de RLS**: verificar que un usuario de la academia A no puede leer
  nada de la academia B. Esto es obligatorio antes de abrir la app a otras academias.

---

## 6. Modelo de datos

Convenciones: `id uuid` como llave primaria, `created_at`/`updated_at` en todas las tablas,
montos en **pesos chilenos enteros** (`integer`, sin decimales), fechas con zona horaria
`America/Santiago`.

### 6.1 Núcleo

| Tabla | Campos principales |
|---|---|
| `academies` | name, slug, logo_path, primary_color, timezone, currency, plan (`basic`/`premium`), join_code, settings (jsonb) |
| `profiles` | user_id (→ auth.users), full_name, phone, avatar_path |
| `memberships` | academy_id, user_id, role (`owner`/`instructor`/`student`/`guardian`), status (`pending`/`active`/`rejected`/`inactive`), approved_by, approved_at |
| `push_tokens` | user_id, token, platform |

### 6.2 Alumnos

| Tabla | Campos principales |
|---|---|
| `students` | academy_id, user_id (null si es menor sin cuenta), guardian_user_id, first_name, last_name, rut, birth_date, gender, photo_path, phone, emergency_contact_name, emergency_contact_phone, medical_notes, prior_experience, prior_belt, category_id, joined_at, status (`pending`/`active`/`inactive`), left_at, left_reason |
| `categories` | academy_id, name, min_age, max_age, sort_order |

> El alumno es una **ficha**, separada de la cuenta de usuario. Así un apoderado puede
> tener varios hijos y un alumno puede existir aunque todavía no tenga cuenta.

### 6.3 Cinturones y graduación

| Tabla | Campos principales |
|---|---|
| `belts` | academy_id, name, color_hex, secondary_color_hex (kids: gris-blanco, etc.), track (`adult`/`kids`), sort_order, max_degrees (ej. 4) |
| `rank_awards` | academy_id, student_id, belt_id, degree (0-4), awarded_at, awarded_by, notes |
| `graduation_requirements` | academy_id, belt_id (cinturón objetivo), degree, min_classes, min_months, min_age, checklist (jsonb) |
| `requirement_checks` | student_id, requirement_id, item_key, checked_by, checked_at |

El cinturón actual de un alumno = último `rank_awards`. El tiempo en el grado actual y las
clases desde el último grado se calculan con una vista SQL (`student_progress`).

### 6.4 Clases y asistencia

| Tabla | Campos principales |
|---|---|
| `class_schedules` | academy_id, weekday, start_time, end_time, title, category_id, instructor_id, active |
| `class_sessions` | academy_id, schedule_id, date, starts_at, ends_at, status (`scheduled`/`cancelled`), notes |
| `attendance` | academy_id, session_id, student_id, checked_in_at, method (`manual`/`qr`/`nfc`), is_late, recorded_by |
| `checkin_codes` | academy_id, code (rotativo), valid_from, valid_until |
| `weekly_techniques` | academy_id, week_start, title, description, video_url |

### 6.5 Pagos

| Tabla | Campos principales |
|---|---|
| `fee_plans` | academy_id, name (ej. "Mensual adulto"), amount, billing_day, enrollment_fee |
| `student_plans` | student_id, fee_plan_id, starts_at, ends_at, discount_pct |
| `charges` | academy_id, student_id, concept (`enrollment`/`monthly`/`event`/`product`/`course`/`other`), period (ej. 2026-11), amount, due_date, status (`pending`/`paid`/`partial`/`void`), description |
| `payments` | academy_id, charge_id, amount, paid_at, method (`cash`/`transfer`/`gateway`), reference, recorded_by |
| `promotions` | academy_id, name, type (`referral`/`percent`/`fixed`), value, valid_from, valid_until |
| `referrals` | academy_id, referrer_student_id, referred_student_id, promotion_id, applied_charge_id |

Deuda de un alumno = suma de `charges` pendientes − pagos parciales. Vista `student_balance`.

### 6.6 Documentos legales

| Tabla | Campos principales |
|---|---|
| `waiver_templates` | academy_id, version, title, body (markdown), active |
| `waiver_signatures` | academy_id, student_id, template_id, signer_name, signer_rut, signer_relationship (`self`/`guardian`), signature_path, pdf_path, signed_at, ip/device |

### 6.7 Comunicación

| Tabla | Campos principales |
|---|---|
| `events` | academy_id, type (`graduation`/`seminar`/`masterclass`/`competition`/`other`), title, description, starts_at, ends_at, location, price, reminder_rule (ej. semanal), audience (categorías) |
| `event_registrations` | event_id, student_id, charge_id |
| `announcements` | academy_id, title, body, image_path, pinned, published_at, show_on_website |
| `notifications` | academy_id, user_id, type, title, body, data (jsonb), scheduled_for, sent_at, read_at |

### 6.8 Contenido (fase 3)

| Tabla | Campos principales |
|---|---|
| `documents` | academy_id, title, file_path, audience |
| `quizzes` / `quiz_questions` / `quiz_options` | academy_id, title, auto_send_after_months · question text · options con is_correct |
| `quiz_assignments` / `quiz_attempts` | student_id, quiz_id, assigned_at · answers, score, submitted_at |
| `courses` / `course_lessons` / `course_purchases` | title, price, cover · video_asset_id (Mux) · student_id, paid_at |
| `posts` / `comments` | academy_id, author_id, body, visibility |
| `products` / `product_sales` | name, price, stock · product_id, student_id, qty, charge_id |
| `audit_log` | academy_id, user_id, action, entity, entity_id, diff (jsonb) |

---

## 7. Pantallas por rol

### Comunes
- Bienvenida · Iniciar sesión · Crear cuenta · Recuperar contraseña
- Elegir academia (si pertenece a más de una)
- Perfil y ajustes de notificaciones

### Dueño / instructor
| Pantalla | Contenido |
|---|---|
| **Inicio (panel)** | Clases de hoy, solicitudes pendientes, alumnos con deuda, próximos eventos |
| **Alumnos** | Lista con buscador y filtros (categoría, cinturón, estado, con deuda) |
| **Ficha del alumno** | Datos, foto, cinturón y grados, progreso, asistencia, pagos, exoneración, notas · botón PDF |
| **Solicitudes** | Aprobar / rechazar nuevos alumnos |
| **Clase de hoy** | Lista para tomar asistencia, mostrar QR de check-in |
| **Horario** | Editar clases semanales |
| **Pagos** | Morosos, registrar pago, cargos del mes, resumen de ingresos |
| **Graduación** | Candidatos, otorgar grado, configurar requisitos |
| **Calendario / Noticias** | Crear eventos y anuncios, técnica de la semana |
| **Configuración de la academia** | Datos, logo, colores, categorías, cinturones, planes y valores, texto de exoneración, instructores |

### Alumno / apoderado
| Pantalla | Contenido |
|---|---|
| **Inicio** | Técnica de la semana, próximo evento, estado de pago, botón "Marcar asistencia" |
| **Mi progreso** | Cinturón y grados, tiempo entrenando, clases totales y desde el último grado, barra hacia el próximo grado |
| **Mis pagos** | Deuda, historial, (fase 3: pagar en línea) |
| **Calendario** | Horario de clases y eventos |
| **Documentos** | Reglamento, manuales |
| **Mis hijos** (apoderado) | Cambiar entre los hijos registrados |

---

## 8. Flujos clave

### 8.1 Alta de un alumno nuevo
1. El alumno paga la matrícula en la academia.
2. El profesor le comparte el **código o enlace de invitación** de la academia.
3. El alumno (o el apoderado) crea su cuenta, ingresa el código y completa la ficha:
   datos, foto (cámara), contacto de emergencia, experiencia previa.
4. La app calcula la categoría por la fecha de nacimiento.
5. Firma la **exoneración** con el dedo (el apoderado si es menor).
6. Queda en estado **pendiente**; el profesor recibe una notificación.
7. El profesor **aprueba** → se asigna el plan de pago y el cinturón inicial
   (blanco o el que traía) → el alumno recibe acceso completo.

### 8.2 Asistencia con QR / NFC
1. En la academia hay un **QR impreso** (y opcionalmente un sticker NFC con el mismo enlace).
2. El alumno escanea → la app abre `/checkin?academy=…&code=…`.
3. El servidor valida: alumno activo, existe una clase en curso o que empieza en ±30 min,
   y que no haya marcado ya esa clase.
4. Se registra la asistencia; si llega después de la hora de inicio + tolerancia, se marca
   **atraso**.
5. El profesor ve la lista en tiempo real y puede corregirla manualmente.

> Usar un enlace en el sticker NFC (en vez de leer NFC dentro de la app) funciona en
> Android y iPhone sin código nativo extra, y los stickers son muy baratos.
> Para evitar que alguien marque desde la casa con una foto del QR: código rotativo
> semanal y, opcionalmente, verificar ubicación.

### 8.3 Ciclo mensual de cobro
1. `pg_cron` corre cada día: si es el día de cobro de un plan, crea el cargo `monthly`
   del período para cada alumno activo.
2. Aplica descuentos y promociones (ej. referido de noviembre).
3. Envía recordatorios: 3 días antes, el día del vencimiento y cada 7 días mientras esté
   atrasado (configurable).
4. El profesor registra el pago (efectivo / transferencia) → el cargo pasa a `paid`.
5. Fase 3: el alumno paga en la app → webhook de la pasarela → cargo `paid` automático.

### 8.4 Graduación
1. El profesor define requisitos por cinturón/grado (clases mínimas, meses mínimos,
   checklist de técnicas).
2. La vista `student_progress` calcula el avance de cada alumno.
3. Lista de **candidatos** para el profesor; él decide y otorga el grado.
4. Queda en el historial con fecha; el alumno recibe una notificación de felicitación.

---

## 9. Notificaciones automáticas

| Disparador | A quién | Cuándo |
|---|---|---|
| Nueva solicitud de ingreso | Dueño / instructores | Inmediato |
| Solicitud aprobada | Alumno / apoderado | Inmediato |
| Mensualidad por vencer | Alumno / apoderado | 3 días antes (configurable) |
| Mensualidad atrasada | Alumno / apoderado | Día de vencimiento y luego semanal |
| Resumen de morosos | Dueño | Semanal |
| Evento importante (graduación, seminario) | Alumnos de la audiencia | Al crearlo y una vez por semana hasta la fecha |
| Técnica de la semana | Alumnos | Lunes en la mañana |
| Nuevo grado otorgado | Alumno / apoderado | Inmediato |
| Test asignado (fase 3) | Alumno | Inmediato |

Implementación: tabla `notifications` como cola → Edge Function `send-notifications`
invocada por `pg_cron` cada 5 minutos → Expo Push API. Cada usuario puede silenciar tipos.

---

## 10. Seguridad, privacidad y legal

- **Datos sensibles**: datos de menores, salud, fotos, firmas y RUT. Todo en buckets
  privados con URLs firmadas de corta duración; nunca enlaces públicos.
- **RLS en todas las tablas**, sin excepción, con tests automáticos.
- La llave `service_role` de Supabase **solo** en Edge Functions, nunca en la app.
- **Consentimiento**: al registrarse, aceptar términos y política de privacidad; para menores,
  el consentimiento lo da el apoderado.
- **Ley de datos personales de Chile**: existe una ley nueva (Ley 21.719) que, según se
  entiende, entra en vigencia alrededor de diciembre de 2026. **Revisar con un abogado**
  antes de abrir la app a otras academias (bases de licitud, derechos de los titulares,
  datos de menores, medidas de seguridad).
- **SII**: cobrar a través de la app (fase 3) implica emitir boletas; el profesor quiere
  hacerlo solo cuando lo tenga en regla. La app solo **registra** pagos hasta entonces.
- **Tiendas de apps y contenido digital**: Apple y Google exigen usar **su propio sistema
  de pago** (con comisión de 15–30 %) para vender contenido digital dentro de la app, como
  los **cursos en video**. Las mensualidades de la academia (servicio físico) no tienen ese
  problema. Opciones para los cursos: venderlos en la web y solo mostrarlos en la app, o
  aceptar la comisión. **Verificar las reglas vigentes antes de la fase 3.**
- **Videos "no descargables"**: el streaming con URLs firmadas evita el enlace directo y
  en Android se puede bloquear la captura de pantalla (`expo-screen-capture`), pero ninguna
  app puede impedir 100 % que alguien grabe la pantalla con otro dispositivo.
- **Auditoría**: registrar en `audit_log` quién cambia fichas, pagos y grados.
- **Respaldos**: activar backups diarios de Supabase (plan Pro) antes de que haya datos reales.

---

## 11. Fases de desarrollo (roadmap)

Las duraciones son estimaciones para **una persona a tiempo parcial**; ajustar según la
disponibilidad real.

### Fase 0 — Preparación (1–2 semanas)
- [ ] Crear proyecto Expo con TypeScript, Expo Router, ESLint y Prettier.
- [ ] Crear proyectos Supabase **dev** y **prod**; CLI de Supabase con migraciones en el repo.
- [ ] Autenticación básica y pantalla de inicio.
- [ ] Diseño base: paleta, tipografía, componentes (botón, input, tarjeta, lista).
- [ ] CI en GitHub Actions: lint + typecheck + tests de base de datos.
- [ ] Build de prueba en un Android real con EAS.

### Fase 1 — MVP para el piloto (6–8 semanas)
- [ ] Crear academia, código de invitación, aprobar solicitudes, roles.
- [ ] Ficha del alumno completa con foto y categoría automática.
- [ ] Registro de menores por apoderado.
- [ ] Exoneración con firma y PDF.
- [ ] Cinturones (plantilla Jiu-Jitsu) e historial de grados.
- [ ] Horario de clases y sesiones.
- [ ] Asistencia manual + check-in con QR + atrasos.
- [ ] Planes, mensualidades automáticas, pagos manuales, vista de morosos.
- [ ] Notificaciones push: solicitudes y recordatorios de pago.
- [ ] Exportar ficha a PDF y lista de alumnos a CSV.
- [ ] Baja de alumnos con historial.
- [ ] **Piloto**: cargar a todos los alumnos de la academia y usarla 1 mes.

### Fase 2 — Comunicación y progreso (4–6 semanas)
- [ ] Programa de graduación con requisitos y barra de progreso.
- [ ] Calendario de eventos con recordatorios semanales y eventos con cobro.
- [ ] Noticias / anuncios y técnica de la semana.
- [ ] Documentos (reglamento, manuales).
- [ ] Ranking de asistencia.
- [ ] Promociones y referidos.
- [ ] Panel con métricas para el profesor.
- [ ] Check-in con sticker NFC.
- [ ] Personalización de la academia (logo, colores).
- [ ] Publicar en **Google Play** (prueba cerrada → producción).

### Fase 3 — Premium y contenido (6–10 semanas)
- [ ] Pasarela de pago (Flow o Mercado Pago) con webhooks.
- [ ] Tests / pruebas con nota y envío automático a los X meses.
- [ ] Cursos en video (Mux) con compra.
- [ ] Muro / testimonios.
- [ ] Inventario y ventas de productos.
- [ ] Noticias visibles en la página web de la academia (API pública de solo lectura).

### Fase 4 — SaaS para otras academias
- [ ] Alta autónoma de academias y asistente de configuración inicial.
- [ ] Planes Básico / Premium y cobro de la suscripción.
- [ ] Publicación en **App Store** (iOS).
- [ ] Página de venta del producto.
- [ ] Revisión legal (términos, privacidad, ley de datos).
- [ ] Soporte y documentación para profesores.

---

## 12. Estructura del repositorio

```
app-jiujitsu-/
├── app/                      # Pantallas (Expo Router)
│   ├── (auth)/               # login, registro, recuperar contraseña
│   ├── (staff)/              # dueño e instructores
│   │   ├── index.tsx         # panel
│   │   ├── students/
│   │   ├── attendance/
│   │   ├── payments/
│   │   ├── graduation/
│   │   └── settings/
│   ├── (member)/             # alumno y apoderado
│   └── checkin.tsx           # destino del QR / NFC
├── src/
│   ├── components/           # UI reutilizable
│   ├── features/             # lógica por módulo (students, attendance, payments…)
│   ├── lib/                  # cliente Supabase, utilidades, fechas
│   └── types/                # tipos generados de la base de datos
├── supabase/
│   ├── migrations/           # SQL versionado (tablas, RLS, vistas)
│   ├── functions/            # Edge Functions (notificaciones, PDFs, cobros)
│   ├── tests/                # tests de RLS (pgTAP)
│   └── seed.sql              # academia de prueba, cinturones, categorías
├── docs/
│   └── PLAN.md               # este documento
├── app.json / eas.json
└── package.json
```

---

## 13. Primeros pasos para empezar a programar

```bash
# 1. Proyecto Expo
npx create-expo-app@latest . --template default
npx expo install expo-router expo-camera expo-notifications expo-print \
  expo-image-picker expo-secure-store @supabase/supabase-js
npm i @tanstack/react-query react-hook-form zod

# 2. Supabase local
npm i -D supabase
npx supabase init
npx supabase start            # levanta Postgres, Auth y Storage locales (requiere Docker)
npx supabase migration new init_core

# 3. Tipos de la base de datos para TypeScript
npx supabase gen types typescript --local > src/types/database.ts

# 4. Correr la app
npx expo start
```

Orden sugerido de la primera migración:
1. `academies`, `profiles`, `memberships` + función `has_role` + políticas RLS.
2. `categories`, `belts`, `students`, `rank_awards`.
3. Seed con la plantilla de Jiu-Jitsu (cinturones adulto y kids, categorías del profesor).
4. Tests de RLS: usuario de la academia A no ve nada de la academia B.

Primera pantalla útil de punta a punta: **crear academia → invitar alumno → alumno completa
ficha → profesor aprueba → aparece en la lista**. Con eso funcionando, el resto se construye
encima.

---

## 14. Preguntas abiertas para el profesor

**Alumnos y fichas**
1. ¿Qué datos exactos quiere en la ficha? ¿Necesita RUT? ¿Previsión de salud, alergias, lesiones?
2. ¿Puede compartir el texto actual de la carta de exoneración?
3. ¿Los alumnos pueden ver a otros alumnos (ranking con nombres) o solo su propia info?

**Cinturones y graduación**
4. ¿Usa el sistema de cinturones IBJJF (adulto y kids) o tiene variaciones?
5. ¿Cuáles son los requisitos de su programa de graduación (clases, meses, técnicas)?
6. ¿"Mi profe" debe poder otorgar grados en su academia?

**Pagos**
7. Valores de matrícula y mensualidad por categoría. ¿Hay planes (2 veces por semana, libre, familiar)?
8. ¿Qué día del mes vence la mensualidad? ¿Hay días de gracia?
9. ¿Cómo funciona exactamente la promo de referidos (una vez, todos los meses, tope)?

**Operación**
10. ¿Cuántos alumnos tiene hoy y cuántos son menores?
11. ¿Los alumnos usan más Android o iPhone? (define si publicar iOS pronto)
12. ¿Puede compartir el Excel de horarios, el reglamento y el manual del alumno nuevo?
13. Tolerancia para marcar atraso (¿5, 10 minutos?).

**Negocio**
14. ¿Conoce otras academias interesadas para un segundo piloto?
15. ¿Qué apps vio en TikTok que le gustaron? (para tomar ideas)

---

## 15. Riesgos y cómo mitigarlos

| Riesgo | Mitigación |
|---|---|
| Querer hacer todo a la vez y no terminar nada | Respetar las fases; el MVP solo tiene lo P1 |
| Filtración de datos entre academias | RLS en todas las tablas + tests automáticos desde el día 1 |
| Datos de menores y legalidad | Buckets privados, consentimiento del apoderado, revisión legal antes de la fase 4 |
| Comisiones de Apple/Google por contenido digital | Decidir el canal de venta de cursos antes de construirlos |
| Los alumnos no usan la app | Check-in con QR como hábito diario + notificaciones útiles (pagos, técnica de la semana) |
| Notificaciones vistas como spam | Pocas, útiles y configurables por el usuario |
| Pérdida de datos | Backups diarios y migraciones versionadas en el repo |
| Dependencia de una sola persona | Documentar decisiones aquí y mantener el código simple |
