# NUNA AI

Asistente de IA sin dependencias. Incluye historial, conversaciones de ejemplo, modo claro/oscuro e interfaz español/inglés. El chat responde siempre con el proveedor elegido; no hay respuestas simuladas. Las conversaciones creadas y preferencias se guardan en el navegador mediante localStorage. Los ejemplos cambian de idioma; los mensajes escritos conservan su idioma original.

## Ejecutar

Desde `/workspace/Nuna-AI`:

```sh
python -m http.server 3000 --bind 0.0.0.0
```

Abre el servidor en un navegador para revisar la interfaz. El chat necesita la función `/api/chat` de Vercel (con sus variables de entorno), así que en local solo verás el aviso de error de conexión al enviar.

## Fluidez

El botón circular junto a Enviar abre el concepto Fluidez integrado. La ventana hereda el tema e idioma del chat. Permite probar ocho estados visuales o reproducir una secuencia de demostración. Cierra con la X o Escape para volver al chat. El micrófono permanece apagado; no se solicita acceso ni se captura audio. El archivo original adjunto se conserva sin cambios.

## Pantallas

Configuración se abre en pantalla completa desde Cuenta personal → ⋯. Incluye Perfil, Seguridad, Voz, Almacenamiento, Uso, Facturación, Control de datos, Plugins, Referidos, Socials, Work, Modelos y General. Seguridad, consumo, publicidad e integraciones muestran estados de demostración; no constituyen servicios reales. Las preferencias y borradores se guardan localmente. La revisión final pasó 60 comprobaciones automatizadas en Chromium de escritorio y móvil. La cámara física, Safari y Firefox requieren comprobación adicional.

## OpenAI en Vercel

`api/chat.js` es una función de servidor sin dependencias. Configura en Vercel (nunca en el HTML):

- `OPENAI_API_KEY`: clave de API del proyecto OpenAI. La suscripción de ChatGPT no sustituye el acceso ni el crédito de API.
- `NUNA_ACCESS_CODE`: código de acceso aleatorio de al menos 16 caracteres. No es una contraseña de usuario; restringe el uso de la IA mientras no haya cuentas reales.
- `NUNA_OPENAI_MODEL`: opcional; por defecto `gpt-4.1-mini`. Debe ser un modelo disponible para tu cuenta y compatible con Responses API.

Después de cambiar variables, vuelve a desplegar. Elige el proveedor en la cabecera y envía un mensaje: la primera vez se pide el código de acceso, que se recuerda en el dispositivo salvo que desmarques «Recordar en este dispositivo» (marcado por defecto). La clave de API permanece en el servidor. No hay modo de prueba ni respuestas simuladas: si la llamada al proveedor falla, se muestra el motivo y el mensaje vuelve al cuadro de texto.

El servidor pide `store: false` en Responses API. Esto no equivale a una garantía de retención cero por parte del proveedor.

## Anthropic

NUNA admite Anthropic Messages API. En Vercel añade `ANTHROPIC_API_KEY` y `NUNA_ANTHROPIC_MODEL` (ID exacto de un modelo disponible en tu cuenta Anthropic). Se usa el mismo `NUNA_ACCESS_CODE`. El modelo Anthropic se configura explícitamente, sin asumir una versión disponible. Selecciona «Claude · Anthropic» en la cabecera y envía texto. No envíes adjuntos: esta integración todavía es solo de texto. Las claves se mantienen en servidor. No se promete retención cero de datos por el proveedor.

## DeepSeek

NUNA admite DeepSeek Chat Completions API. Configura `DEEPSEEK_API_KEY` en Vercel como secreto y opcionalmente `NUNA_DEEPSEEK_MODEL` (por defecto `deepseek-chat`). Se reutiliza `NUNA_ACCESS_CODE`. Selecciona DeepSeek en la cabecera y envía un mensaje. Se admite solo texto. Verifica acceso y crédito en la cuenta del proveedor.

## Google Gemini

Configura `GEMINI_API_KEY` como secreto en Vercel. `NUNA_GEMINI_MODEL` es opcional; por defecto `gemini-flash-latest`, el alias de Google al Flash estable más reciente (`gemini-2.5-flash` ya no está disponible para claves nuevas). Se usa GenerateContent API con clave en cabecera, historial user/model y límite de salida. Selecciona Gemini en la cabecera y envía un mensaje. Se reutiliza `NUNA_ACCESS_CODE`.

## Grok (xAI)

Configura `XAI_API_KEY` como secreto y `NUNA_GROK_MODEL` con el ID exacto de un modelo disponible en tu cuenta xAI (no se asume ninguno). Usa Chat Completions de xAI. Se reutiliza `NUNA_ACCESS_CODE`. Solo texto. Pendiente de verificar con una respuesta real.

## Qwen (Alibaba Cloud)

Configura `DASHSCOPE_API_KEY` como secreto. `NUNA_QWEN_MODEL` es opcional (por defecto `qwen-plus`). `NUNA_QWEN_BASE_URL` apunta por defecto al endpoint internacional compatible con OpenAI; para China continental usa `https://dashscope.aliyuncs.com/compatible-mode/v1`. Solo texto. Pendiente de verificar con una respuesta real.

## Diagnóstico

Cada error de `/api/chat` deja en los registros de Vercel una línea `nuna_chat_error` con el código y el proveedor, sin claves ni contenido de mensajes. Sirve para saber, por ejemplo, si falta el código privado, si es demasiado corto o si falta el modelo de un proveedor.

`.env.example` lista todas las variables sin valores.

## Supabase (fase siguiente)

`supabase/schema.sql` propone perfiles, proyectos, conversaciones, mensajes y perfil profesional (Work) con Row Level Security. Todavía no está aplicado ni conectado: los datos siguen guardándose en el navegador.

## Voz

En Configuración → Voz, «Escuchar» reproduce una muestra con la síntesis de voz del propio navegador. La voz exacta depende del dispositivo; la voz final se definirá al conectar un proveedor de audio. El micrófono sigue apagado.

## Modelos: selector y estado real

El selector de la cabecera abre un menú para cambiar de modelo sin entrar en Configuración. Cada mensaje lo responde un solo modelo. En Configuración → Modelos, cada proveedor muestra su estado:

- **Sin comprobar**: aún no se ha introducido el código privado.
- **Falta clave / Falta modelo**: el servidor no tiene la variable correspondiente en este despliegue.
- **Configurado · sin verificar**: hay clave y modelo, pero todavía no hubo una respuesta real.
- **Verificado**: este navegador recibió una respuesta real del proveedor (chat o «Probar conexión»).

`GET /api/chat` con el código privado devuelve solo si cada proveedor tiene clave y modelo configurados (`true`/`false`), nunca valores ni identificadores. «Probar conexión» hace una llamada real y breve al proveedor y puede consumir crédito de API.

## Modelo no encontrado o sin configurar

Si el proveedor responde que no encuentra el modelo (404, o un 400 de modelo inexistente en OpenAI y DeepSeek), o si falta su variable de modelo, `/api/chat` pregunta al proveedor qué modelos admite la clave y devuelve hasta 40 nombres (sin embeddings, audio ni imágenes). La interfaz los muestra junto a la variable que hay que definir en Vercel, por ejemplo `NUNA_GEMINI_MODEL`, y recuerda volver a desplegar. Los nombres también quedan en la línea `nuna_chat_error` del registro. Nunca se devuelven claves.

## Chat real y código de acceso

No hay modo de prueba ni respuestas simuladas: cada mensaje va al proveedor elegido en la cabecera. Mientras NUNA no tenga cuentas de usuario, `/api/chat` exige el código de acceso (`NUNA_ACCESS_CODE`). Se pide la primera vez que se envía un mensaje y con «Recordar en este dispositivo» (marcado por defecto) se guarda en el navegador (`localStorage`). Configuración → Modelos permite olvidarlo. Si el código no coincide, se borra y se vuelve a pedir; el mensaje escrito se conserva.

Las funciones que aún no están conectadas (cuentas, pagos, voz, redes, plugins) siguen indicándolo en sus pantallas.

## Claude (Anthropic)

`NUNA_ANTHROPIC_MODEL=claude-opus-5-5`. Claude Opus 5 / 5.5, Fable 5 y Sonnet 5.5 siempre razonan antes de responder: `NUNA_ANTHROPIC_EFFORT` (por defecto `low`, para respuestas rápidas en el chat) controla cuánto, y `max_tokens` es 16000 porque el razonamiento cuenta dentro de ese límite. Si los filtros de seguridad de Anthropic rechazan una pregunta, la API la reintenta en el modelo de respaldo que Anthropic recomienda (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); si todo el recorrido la rechaza, NUNA muestra «El proveedor bloqueó esta solicitud».
