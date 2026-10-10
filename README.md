> **Acceso obligatorio:** chat, voz y API personales requieren una cuenta de Supabase con email confirmado. El código privado ya no permite usar la IA sin sesión, tampoco para administradores. En Supabase Auth debe estar activado **Confirm email**; esta configuración se verifica en el proyecto, no se cambia desde este repositorio. El Worker de almacenamiento también exige email confirmado y requiere desplegar su actualización por separado.

# NUNA AI

Asistente de IA sin dependencias. Incluye historial, conversaciones de ejemplo, modo claro/oscuro e interfaz español/inglés. El chat responde siempre con el proveedor elegido; no hay respuestas simuladas. Con una cuenta de NUNA, las conversaciones y proyectos se guardan en la cuenta (Supabase); sin sesión iniciada, en el navegador mediante localStorage. Las preferencias se guardan siempre en el navegador. Los ejemplos cambian de idioma; los mensajes escritos conservan su idioma original.

## Ejecutar

Desde `/workspace/Nuna-AI`:

```sh
python -m http.server 3000 --bind 0.0.0.0
```

Abre el servidor en un navegador para revisar la interfaz. El chat necesita la función `/api/chat` de Vercel (con sus variables de entorno), así que en local solo verás el aviso de error de conexión al enviar.

## Fluidez

El botón circular junto a Enviar abre el concepto Fluidez integrado. La ventana hereda el tema e idioma del chat. Permite probar ocho estados visuales o reproducir una secuencia de demostración. Cierra con la X o Escape para volver al chat. El micrófono permanece apagado; no se solicita acceso ni se captura audio. El archivo original adjunto se conserva sin cambios.

## Pantallas

Configuración se abre en pantalla completa desde Cuenta personal → ⋯. Incluye Perfil, Seguridad, Voz, Almacenamiento, Uso, Facturación, Control de datos, Plugins, Referidos, Socials, Work, Modelos y General. Seguridad muestra la cuenta real y Uso el contador diario real; los métodos de acceso adicionales, la publicidad y las integraciones todavía indican que están pendientes. Las preferencias y borradores se guardan localmente. La revisión final pasó 60 comprobaciones automatizadas en Chromium de escritorio y móvil. La cámara física, Safari y Firefox requieren comprobación adicional.

## OpenAI en Vercel

`api/chat.js` es una función de servidor sin dependencias. Configura en Vercel (nunca en el HTML):

- `OPENAI_API_KEY`: clave de API del proyecto OpenAI. La suscripción de ChatGPT no sustituye el acceso ni el crédito de API.
- `NUNA_ACCESS_CODE`: código de acceso aleatorio de al menos 16 caracteres, solo para quien administra NUNA (uso sin límite diario). Las demás personas usan su cuenta.
- `NUNA_OPENAI_MODEL`: opcional; por defecto `gpt-4.1-mini`. Debe ser un modelo disponible para tu cuenta y compatible con Responses API.

Después de cambiar variables, vuelve a desplegar. Elige el proveedor en la cabecera y envía un mensaje: sin sesión iniciada se abre el inicio de sesión (que también ofrece el código de administrador). La clave de API permanece en el servidor. No hay modo de prueba ni respuestas simuladas: si la llamada al proveedor falla, se muestra el motivo y el mensaje vuelve al cuadro de texto.

El servidor pide `store: false` en Responses API. Esto no equivale a una garantía de retención cero por parte del proveedor.

## Anthropic

NUNA admite Anthropic Messages API. En Vercel añade `ANTHROPIC_API_KEY` y `NUNA_ANTHROPIC_MODEL` (ID exacto de un modelo disponible en tu cuenta Anthropic). Se usa el mismo `NUNA_ACCESS_CODE`. El modelo Anthropic se configura explícitamente, sin asumir una versión disponible. Selecciona «Claude · Anthropic» en la cabecera y envía texto. No envíes adjuntos: esta integración todavía es solo de texto. Las claves se mantienen en servidor. No se promete retención cero de datos por el proveedor.

## DeepSeek

NUNA admite DeepSeek Chat Completions API. Configura `DEEPSEEK_API_KEY` en Vercel como secreto y opcionalmente `NUNA_DEEPSEEK_MODEL` (por defecto `deepseek-chat`). Se reutiliza `NUNA_ACCESS_CODE`. Selecciona DeepSeek en la cabecera y envía un mensaje. Se admite solo texto. Verifica acceso y crédito en la cuenta del proveedor.

## Google Gemini

Configura `GEMINI_API_KEY` como secreto en Vercel. `NUNA_GEMINI_MODEL` es opcional; por defecto `gemini-flash-latest`, el alias de Google al Flash estable más reciente (`gemini-2.5-flash` ya no está disponible para claves nuevas). Se usa GenerateContent API con clave en cabecera, historial user/model y límite de salida. Selecciona Gemini en la cabecera y envía un mensaje. Se reutiliza `NUNA_ACCESS_CODE`.

## Grok (xAI)

Configura `XAI_API_KEY` como secreto y `NUNA_GROK_MODEL` con el ID exacto de un modelo disponible en tu cuenta xAI (no se asume ninguno; en producción, `grok-4.7`). Grok recibe `max_tokens` 8192 porque los modelos 4.x pueden razonar antes de responder. Usa Chat Completions de xAI. Se reutiliza `NUNA_ACCESS_CODE`. Solo texto. 

## Qwen (Alibaba Cloud)

Configura `DASHSCOPE_API_KEY` como secreto. `NUNA_QWEN_MODEL` es opcional (por defecto `qwen-plus`). `NUNA_QWEN_BASE_URL` apunta por defecto al endpoint internacional compatible con OpenAI; para China continental usa `https://dashscope.aliyuncs.com/compatible-mode/v1`. Solo texto. Verificado con respuesta real en producción.

## Diagnóstico

Cada error de `/api/chat` deja en los registros de Vercel una línea `nuna_chat_error` con el código y el proveedor, sin claves ni contenido de mensajes. Sirve para saber, por ejemplo, si falta el código privado, si es demasiado corto o si falta el modelo de un proveedor.

`.env.example` lista todas las variables sin valores.

## Cuentas (Supabase)

Proyecto de Supabase «Nuna-AI». El esquema está en `supabase/migrations/20261006000000_accounts_and_usage.sql` y ya está aplicado:

- `public.conversations` (una fila por chat) y `public.user_state` (proyectos, asignaciones y ejemplos ocultos), con Row Level Security: cada persona solo lee y modifica sus filas.
- `private.ai_usage` y `private.ai_reservations`, fuera de la API: nadie puede escribirlas directamente.
- `consume_ai_message`, `refund_ai_message` y `ai_usage_today`: cuentan los mensajes de IA de cada cuenta por día (UTC).

Variables en Vercel (valores públicos; el acceso lo controla la base de datos):

- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`: el navegador los recibe de `GET /api/config` para iniciar sesión.
- `NUNA_DAILY_LIMIT`: con `0` pausa la IA para todas las cuentas salvo las de administrador. Los límites diarios salen del plan de cada cuenta.
- `NUNA_FREE_MODEL`: modelo económico del plan Gratis en DashScope; por defecto `qwen3.7-flash`.

### Planes y costes

Migraciones `supabase/migrations/20261007000000_plans_and_ai_events.sql`, `20261007010000_media_caps_and_event_integrity.sql` y `20261009000000_admin_plan_and_background_quota.sql`:

| Plan | Mensajes al día | Modelos | Imágenes / videos / sesiones de voz al día | Almacenamiento |
|---|---|---|---|---|
| Gratis (por defecto) | 30 | solo el modelo económico (`NUNA_FREE_MODEL`, Qwen) | 0 / 0 / 0 | 2 GB |
| Plus | 150 | el que elija la persona | 10 / 1 / 2 | por definir |
| Pro | 500 | el que elija la persona | 30 / 3 / 5 | por definir |
| Administrador | sin límite | todos | sin límite | sin límite |

- Los límites están en `private.plans` y el plan de cada cuenta en `private.account_plans`; una cuenta sin fila es Gratis. No hay API para cambiarlo: se asigna desde Supabase. Ejemplo: `insert into private.account_plans (owner, plan) select id, 'plus' from auth.users where email = 'persona@ejemplo.com' on conflict (owner) do update set plan = excluded.plan, updated_at = now();`
- Cada imagen, video o sesión de voz (hasta 5 minutos) gasta uno del tope de su tipo y además un mensaje. Los topes son de seguridad hasta que existan los créditos; se cambian con, por ejemplo, `update private.plans set daily_videos = 2 where id = 'plus';`.
- En el plan Gratis, los títulos de las conversaciones y la memoria también usan el modelo económico. Cada título o actualización de memoria gasta un mensaje del día y queda en el registro de costes.
- El plan Administrador no tiene restricciones: el servidor lo trata igual que una cuenta de `NUNA_ADMIN_EMAILS` (la pantalla Uso muestra «Cuenta de administrador»). Se asigna como cualquier plan: `insert into private.account_plans (owner, plan) select id, 'administrador' from auth.users where email = 'persona@ejemplo.com' on conflict (owner) do update set plan = excluded.plan, updated_at = now();`
- La voz limita cada sesión a 5 minutos en el navegador; OpenAI no permite cortarla desde el servidor y la corta a los 60 minutos. Por eso las sesiones de voz al día de cada plan son pocas.
- Los administradores (`NUNA_ADMIN_EMAILS`) no tienen plan ni límite.
- Cada respuesta de IA y cada sesión de voz de una cuenta guarda en `private.ai_events` el plan, el proveedor, el modelo, los tokens que informó el proveedor y el coste estimado con la tabla de precios oficiales de `api/_plans.js`. Nunca se guarda el contenido. Los modelos sin precio confirmado (y la voz, que se cobra por minutos de uso) se registran sin coste. La base de datos solo acepta una fila por mensaje que el servidor reservó para esa persona.
- Coste por plan en los últimos 30 días (las cuentas de administrador aparte; pon sus correos): `select case when u.email = any (array['admin@ejemplo.com']) then 'admin' else e.plan end plan, e.kind, count(*) usos, sum(e.input_tokens) entrada, sum(e.output_tokens) salida, sum(e.cost_usd) coste from private.ai_events e join auth.users u on u.id = e.owner where e.created_at > now() - interval '30 days' group by 1, 2 order by 1, 2;`
- `NUNA_ADMIN_EMAILS`: correos de las cuentas de administrador, separados por comas. Esas cuentas no tienen límite diario (sus mensajes se siguen contando) y pueden usar imágenes, videos y voz sin tope, igual que el código de acceso en el chat y la voz. El servidor confirma con Supabase Auth que la sesión es válida y el correo está verificado.

No hace falta la clave secreta (`service_role`): `/api/chat` llama a las funciones de la base de datos con la sesión de la persona, y Supabase verifica el token.

Flujo de `/api/chat` con una cuenta: la interfaz envía `Authorization: Bearer <token de sesión>`. Antes de llamar al proveedor, el servidor descuenta un mensaje del día (así, peticiones en paralelo no pueden pasar del límite). Si el proveedor falla (error HTTP o sin conexión), el mensaje se devuelve; un rechazo de seguridad o una respuesta cortada sí cuentan. Al llegar al límite responde `429 daily_limit`. Con el código de administrador (`x-nuna-access-code`) no hay límite.

Acceso: correo y contraseña (con confirmación por correo), recuperación de contraseña y Google cuando esté activado en Supabase (el botón solo aparece si `/auth/v1/settings` lo indica). Al iniciar sesión, los chats creados antes en ese navegador se añaden a la cuenta y se quitan del navegador; al cerrar sesión, la vista queda vacía.

Pendiente en el panel de Supabase: URL del sitio y redirecciones (Authentication → URL Configuration), proveedor de Google, SMTP propio para enviar correos a cualquier dirección (el SMTP incluido solo envía a los miembros del equipo del proyecto) y la protección de contraseñas filtradas.

## Voz

En Configuración → Voz, «Escuchar» reproduce una muestra con la síntesis de voz del propio navegador. La voz exacta depende del dispositivo; la voz final se definirá al conectar un proveedor de audio. El micrófono sigue apagado.

## Modelos: selector y estado real

El selector de la cabecera abre un menú para cambiar de modelo sin entrar en Configuración. Cada mensaje lo responde un solo modelo. En Configuración → Modelos, cada proveedor muestra su estado:

- **Sin comprobar**: aún no se ha comprobado (hace falta sesión iniciada o el código de administrador).
- **Falta clave / Falta modelo**: el servidor no tiene la variable correspondiente en este despliegue.
- **Configurado · sin verificar**: hay clave y modelo, pero todavía no hubo una respuesta real.
- **Verificado**: este navegador recibió una respuesta real del proveedor (chat o «Probar conexión»).

`GET /api/chat` con sesión o con el código de administrador devuelve solo si cada proveedor tiene clave y modelo configurados (`true`/`false`), nunca valores ni identificadores, y con sesión también los mensajes usados hoy. «Probar conexión» hace una llamada real y breve al proveedor, consume crédito de API y cuenta como un mensaje del límite diario.

## Modelo no encontrado o sin configurar

Si el proveedor responde que no encuentra el modelo (404, o un 400 de modelo inexistente en OpenAI y DeepSeek), o si falta su variable de modelo, `/api/chat` pregunta al proveedor qué modelos admite la clave y devuelve hasta 40 nombres (sin embeddings, audio ni imágenes). La interfaz los muestra junto a la variable que hay que definir en Vercel, por ejemplo `NUNA_GEMINI_MODEL`, y recuerda volver a desplegar. Los nombres también quedan en la línea `nuna_chat_error` del registro. Nunca se devuelven claves.

## Chat real y código de acceso

No hay modo de prueba ni respuestas simuladas: cada mensaje va al proveedor elegido en la cabecera. `/api/chat` exige una sesión de NUNA o el código de administrador (`NUNA_ACCESS_CODE`). El código se escribe desde «Tengo un código de acceso de administrador» en el inicio de sesión y, con «Recordar en este dispositivo» (marcado por defecto), se guarda en el navegador (`localStorage`). Configuración → Modelos permite olvidarlo. Si el código no coincide, se borra; el mensaje escrito se conserva.

Las funciones que aún no están conectadas (pagos, voz, redes, plugins, llaves de acceso) siguen indicándolo en sus pantallas.

## Claude (Anthropic)

`NUNA_ANTHROPIC_MODEL=claude-opus-5-5`. Claude Opus 5 / 5.5, Fable 5 y Sonnet 5.5 siempre razonan antes de responder: `NUNA_ANTHROPIC_EFFORT` (por defecto `low`, para respuestas rápidas en el chat) controla cuánto, y `max_tokens` es 16000 porque el razonamiento cuenta dentro de ese límite. Si los filtros de seguridad de Anthropic rechazan una pregunta, la API la reintenta en el modelo de respaldo que Anthropic recomienda (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); si todo el recorrido la rechaza, NUNA muestra «El proveedor bloqueó esta solicitud».

### Private account files (Cloudflare R2)

`cloudflare/worker.mjs` verifies the Supabase session with Auth before routing to one SQLite-backed Durable Object per account. Only the Worker has a binding to the private `nuna-private-files` bucket; no R2 credentials or public bucket URLs are exposed. The Supabase publishable key in the Worker configuration is public by design.

Each account receives a **15,000,000,000-byte total file allowance**, not an additional monthly allowance. The server counts existing Supabase files plus ready and pending R2 uploads. SQLite reserves upload bytes synchronously before the R2 write, preventing concurrent uploads from exceeding the quota. Failed writes release reservations after confirmed cleanup; an alarm reconciles interrupted writes. Files currently remain limited to **10 MiB per upload**. Chats and projects retain their existing Supabase persistence and separate chat limits. Generation and inline media playback are separate features.

Existing Supabase files stay readable. After releasing the R2 frontend, remove only the `nuna_files_upload` INSERT policy using `supabase/r2-cutover.sql`; this closes the old upload route without deleting files or changing their download permissions. Apply `supabase/account-file-usage.sql` before release. The usage RPC runs with the signed-in user's privileges and RLS.

Validation: `node cloudflare/worker.test.mjs` and `node cloudflare/frontend.test.cjs`. Deploy the Worker with pinned Wrangler 4.148.0 using `cloudflare/wrangler.jsonc`, then verify authenticated upload, reload, download, and the private bucket before releasing the frontend. Cloudflare Workers and Durable Objects have their own request/compute/storage allowances; R2 file storage pricing alone is not the entire infrastructure bill.

### Video uploads and administrator allowance
Videos accept up to 150,000,000 bytes per file; other files retain the 10 MiB cap. Uploads stream through FixedLengthStream to R2 and reject mismatched lengths. The server validates the Supabase identity and exempts only ADMIN_USER_ID from the total 15 GB quota; clients cannot supply this exemption. Administrator files remain subject to upload caps and normal provider billing.
