# NUNA AI

Mockup navegable sin dependencias ni servicios externos. Incluye historial, conversaciones de ejemplo, respuestas simuladas, modo claro/oscuro e interfaz español/inglés. Las conversaciones creadas y preferencias se guardan en el navegador mediante localStorage. Los ejemplos cambian de idioma; los mensajes escritos conservan su idioma original.

## Ejecutar

Desde `/workspace/Nuna-AI`:

```sh
python -m http.server 3000 --bind 0.0.0.0
```

Abre el servidor en un navegador. También puedes abrir `index.html` directamente. No requiere claves, APIs, pagos ni instalación de paquetes.

## Fluidez

El botón circular junto a Enviar abre el concepto Fluidez integrado. La ventana hereda el tema e idioma del chat. Permite probar ocho estados visuales o reproducir una secuencia de demostración. Cierra con la X o Escape para volver al chat. El micrófono permanece apagado; no se solicita acceso ni se captura audio. El archivo original adjunto se conserva sin cambios.

## Revisión del mockup

Configuración se abre en pantalla completa desde Cuenta personal → ⋯. Incluye Perfil, Seguridad, Voz, Almacenamiento, Uso, Facturación, Control de datos, Plugins, Referidos, Socials, Work, Modelos y General. Seguridad, consumo, publicidad e integraciones muestran estados de demostración; no constituyen servicios reales. Las preferencias y borradores se guardan localmente. La revisión final pasó 60 comprobaciones automatizadas en Chromium de escritorio y móvil. La cámara física, Safari y Firefox requieren comprobación adicional.

## Prueba privada de OpenAI en Vercel

`api/chat.js` es una función de servidor sin dependencias. Configura en Vercel (nunca en el HTML):

- `OPENAI_API_KEY`: clave de API del proyecto OpenAI. La suscripción de ChatGPT no sustituye el acceso ni el crédito de API.
- `NUNA_ACCESS_CODE`: código de prueba privado y aleatorio de al menos 16 caracteres. No es una contraseña de usuario; mantiene restringida esta prueba mientras no haya autenticación real.
- `NUNA_OPENAI_MODEL`: opcional; por defecto `gpt-4.1-mini`. Debe ser un modelo disponible para tu cuenta y compatible con Responses API.

Después de cambiar variables, vuelve a desplegar. Usa «Probar OpenAI» e introduce solamente el código privado. La clave de API permanece en servidor. El código de prueba permanece en memoria de la página y se pierde al recargar. El endpoint exige este código, admite solo texto y limita tamaño de conversación y salida. No habilita seguridad de cuentas, límites globales de gasto ni autenticación por usuario. Usa límites de gasto del proveedor y restringe quién recibe el código. El modo normal permanece simulado; un error de API nunca se sustituye por una respuesta ficticia.

El servidor pide `store: false` en Responses API. Esto no equivale a una garantía de retención cero por parte del proveedor.

## Anthropic

La prueba privada también admite Anthropic Messages API. En Vercel añade `ANTHROPIC_API_KEY` y `NUNA_ANTHROPIC_MODEL` (ID exacto de un modelo disponible en tu cuenta Anthropic). Se usa el mismo `NUNA_ACCESS_CODE`. El modelo Anthropic se configura explícitamente, sin asumir una versión disponible. Selecciona «Claude · Anthropic», activa «Probar IA» y envía texto. No envíes adjuntos: esta integración todavía es solo de texto. Las claves se mantienen en servidor. No se promete retención cero de datos por el proveedor.

## DeepSeek

La prueba privada admite DeepSeek Chat Completions API. Configura `DEEPSEEK_API_KEY` en Vercel como secreto y opcionalmente `NUNA_DEEPSEEK_MODEL` (por defecto `deepseek-chat`). Se reutiliza `NUNA_ACCESS_CODE`. Selecciona DeepSeek y activa «Probar IA». Se admite solo texto. Verifica acceso y crédito en la cuenta del proveedor; una prueba simulada no demuestra disponibilidad real.

## Google Gemini

Configura `GEMINI_API_KEY` como secreto en Vercel. `NUNA_GEMINI_MODEL` es opcional; por defecto `gemini-2.5-flash`. Se usa GenerateContent API con clave en cabecera, historial user/model y límite de salida. Selecciona Gemini y activa «Probar IA». Se reutiliza `NUNA_ACCESS_CODE`. La disponibilidad y cuota del modelo deben verificarse con tu cuenta; solo se ha probado el recorrido con respuestas simuladas.

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
