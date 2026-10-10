# Controles de gasto de NUNA

## Cambios implementados

- Títulos y aprendizaje de memoria reservan una llamada del cupo diario mediante el mismo contador atómico del chat antes de contactar al proveedor. Se registran los tokens y el coste estimado cuando el proveedor los reporta. Un error sin datos de consumo queda registrado con coste desconocido y conserva el cupo. Leer o editar manualmente memoria no consume llamadas.
- Consecuencia para los planes: el cupo diario ahora incluye chat, títulos y aprendizaje automático. Un mensaje que active los tres puede consumir tres llamadas. Estos eventos aparecen como `chat` en el registro existente; todavía no hay una categoría separada de títulos/memoria. Los costes son estimaciones, no facturas del proveedor.
- La conexión local de Qwen pide desactivar pensamiento, limita la respuesta a 600 tokens y rechaza respuestas truncadas o que contengan etiquetas de pensamiento. El motor instalado debe respetar las opciones; falta validarlo con la PC real.
- El respaldo de Qwen en la nube está desactivado salvo que `NUNA_LOCAL_QWEN_FALLBACK` sea `true`, `1`, `yes` u `on`, sin distinguir mayúsculas. Se reutiliza la identidad ya verificada para evitar cambios de ruta por otra consulta de sesión.
- Cuando los documentos exceden el presupuesto del contexto local, se omiten y se exige informar al usuario. No se afirma haberlos leído. El presupuesto por caracteres es aproximado y no sustituye al tokenizador del modelo.
- Las imágenes conservan su reserva ante respuestas defectuosas, errores de servidor o cortes de red cuyo resultado de facturación es desconocido. Se devuelve ante rechazos conocidos previos a ejecución o fallos inequívocos de conexión. Esto puede conservar un cupo aunque finalmente no haya habido cobro; es deliberado para evitar reintentos con gasto ilimitado.
- La clave de OpenAI utilizada en memoria se normaliza quitando espacios externos.

## Voz con límite impuesto por el servidor

El navegador utiliza una pasarela de Cloudflare, no recibe credenciales de OpenAI. Cada ticket dura 30 segundos para iniciar una única conexión. Un Durable Object establece un máximo de 300 segundos, cierra el socket del navegador y el de OpenAI, y mantiene una alarma como respaldo. También limita eventos, volumen de audio y texto. El cliente no puede cambiar el modelo, las instrucciones ni el límite de salida.

El servidor mantiene verificación de email, restricciones del plan y reserva de cupo. Si la pasarela no está configurada, devuelve `voice_gateway_unavailable` sin consumir cupo. No se conserva una vía directa a OpenAI que evada el límite. Se registran los tokens reportados al terminar; el coste de voz queda desconocido, porque el desglose y las tarifas de audio requieren conciliación con el proveedor. El registro puede fallar si Supabase no está disponible o la sesión de la cuenta vence; el límite de tiempo sigue siendo independiente de ese registro.

## Activación pendiente

La pasarela ya está desplegada y tiene su clave de OpenAI guardada como secreto. Se recibió audio real en una prueba de infraestructura; la validación del flujo completo de NUNA con cuenta y registro de consumo sigue pendiente. No crear planes de pago ni comprar servicios para esta configuración.

1. En el entorno cloud de Codex, guardar `CLOUDFLARE_API_TOKEN` de forma segura, con permisos Workers Scripts y acceso al ámbito de cuenta requerido por Workers/Durable Objects. El borrador del entorno añade `api.cloudflare.com`. Revisar, guardar y publicar ese borrador para aplicar el acceso; guardarlo no despliega nada.
2. Revisar que la cuenta Cloudflare existente admite Durable Objects SQLite y sus límites/costes. Si requiere activar un servicio de pago, detenerse y consultarlo.
3. Desplegar usando Wrangler 4.148.0 y `cloudflare/voice-wrangler.jsonc` en la cuenta correcta. El Worker es independiente del almacenamiento privado existente. Guardar en sus secretos `OPENAI_API_KEY` y `GATEWAY_SECRET` (aleatorio, al menos 32 caracteres); usar campos secretos, nunca GitHub ni el chat. No usar el token de Cloudflare como secreto de la pasarela.
4. En Vercel configurar `NUNA_VOICE_GATEWAY_URL` con la dirección HTTPS del Worker y `NUNA_VOICE_GATEWAY_SECRET` con el mismo secreto de pasarela. Mantener `NUNA_VOICE_MODEL` con un modelo Realtime disponible en la cuenta. Guardar en los entornos adecuados y volver a desplegar.
5. Probar con una cuenta confirmada y un plan que permita voz: conexión y audio reales, detención manual, cierre de ambos sockets al cumplirse 300 segundos, rechazo de ticket reutilizado, y registro de consumo. Confirmar en el proveedor que la sesión terminó. Una prueba real puede consumir crédito de API.

No activar la nueva versión de voz en producción antes de configurar la pasarela; de lo contrario la voz estará temporalmente no disponible. Las correcciones se entregan en una rama independiente para revisar y coordinar la activación.

## Comprobaciones

Ejecutar con Node.js 22:

```sh
node --test tests/*.test.cjs tests/*.test.mjs
```

Las pruebas usan proveedores, base de datos, audio y sockets simulados. Comprueban reservas de cupo, tokens de títulos, rechazo sin sesión confirmada, rutas locales sin respaldo, imágenes con resultado desconocido, tickets de voz de un solo uso, restricciones de eventos y cierre de ambos sockets por alarma. No prueban la configuración real de Supabase, Cloudflare, OpenAI ni el motor de la PC.

## Revisión de activación — 2026-10-09

- Se confirmó acceso real a la API de Vercel (HTTP 200) y al proyecto existente `nunua-ai`, vinculado a `rarevalo0306-hash/Nuna-AI`, con producción en `main`. Se inspeccionaron únicamente metadatos de configuración, sin mostrar valores secretos. Ya existe `OPENAI_API_KEY`; faltan `NUNA_VOICE_GATEWAY_URL` y `NUNA_VOICE_GATEWAY_SECRET`.
- Falta la credencial de administración de Cloudflare. Se guardó el requisito `CLOUDFLARE_API_TOKEN` en el borrador seguro del entorno con destino `api.cloudflare.com`; requiere guardar el token en la configuración y publicar el entorno antes de usarlo. No se ha confirmado todavía la cuenta ni la disponibilidad del plan gratuito para este Worker.
- Se corrigió una carrera de cierre: si la alarma termina la sesión durante el handshake, la pasarela cierra el socket tardío de OpenAI y no entrega conexión al navegador.
- Las 70 pruebas simuladas originales pasaron con Node 24. Con la regresión del handshake añadida, las 71 pruebas simuladas pasaron con Node 22. No son pruebas de servicios reales.
- Wrangler 4.148.0 completó `deploy --dry-run` con `cloudflare/voice-wrangler.jsonc`, incluyendo el binding `VOICE_SESSIONS`. Esto verifica el empaquetado, no el despliegue ni la autorización de Cloudflare.
- Siguen pendientes el despliegue real, autenticación y reutilización de tickets en Cloudflare, audio real, cierre de OpenAI a los 300 segundos y comprobación del registro de consumo. No se publicó producción ni se activaron servicios de pago; proyectos, modelos, conversaciones y almacenamiento existentes permanecen intactos.

## Despliegue realizado — 2026-10-09

- Se verificó el token Cloudflare activo y acceso real a la cuenta existente de NUNA. Se desplegó únicamente `nuna-voice-gateway` con Wrangler 4.148.0 y Durable Objects SQLite; no se activó una suscripción ni se modificó `nuna-private-storage`.
- Dirección: `https://nuna-voice-gateway.nuna-security.workers.dev`. Versión desplegada: `ba5e92a7-06c5-4b52-95a6-f313468f9b48`.
- Se generó un secreto de pasarela y se guardó directamente como secreto `GATEWAY_SECRET` en Cloudflare y variable sensible `NUNA_VOICE_GATEWAY_SECRET` en Vercel, sin escribirlo en archivos, Git o informes. `NUNA_VOICE_GATEWAY_URL` quedó guardada en Vercel. Ambas variables están configuradas para Production y Preview. No se reinició ni se publicó el frontend de producción.
- Comprobaciones reales contra el Worker: POST `/sessions` sin autenticación devuelve 401 `unauthorized`; un origen ajeno devuelve 403 `origin_denied`. Una primera petición con User-Agent de Python recibió el bloqueo 1010 de Cloudflare; con User-Agent de navegador se obtuvieron las respuestas de aplicación esperadas.
- Las 71 pruebas simuladas volvieron a pasar.
- Bloqueo concreto: falta el secreto `OPENAI_API_KEY` en el nuevo Worker. La clave ya guardada en Vercel es sensible y no se intentó recuperar ni descifrar. El titular debe añadir la clave mediante el formulario seguro de Cloudflare, en Workers & Pages → nuna-voice-gateway → Settings → Variables and Secrets → Add → Secret.
- Después de guardar esa clave siguen pendientes la prueba real autenticada, tickets, audio, cierre del proveedor a los 300 segundos y registro de consumo; solo entonces coordinar la publicación del frontend. El despliegue de infraestructura no equivale a voz real funcionando.

## Validación de credenciales y disponibilidad — 2026-10-09

- El titular añadió `OPENAI_API_KEY` como variable de texto en Cloudflare. Se convirtió a secreto en el mismo Worker, sin mostrar su valor ni guardarlo en archivos. Se conservó el secreto de pasarela.
- Se añadió GET `/health`, privado y autenticado por el secreto de la pasarela, que consulta la disponibilidad del modelo en OpenAI sin generar contenido. El frontend ya no debe informar `ready` basándose únicamente en variables presentes.
- La prueba real detectó que `redirect: error` no funciona en el runtime de Cloudflare. La pasarela usa `redirect: manual` y rechaza respuestas no satisfactorias, sin seguir redirecciones con credenciales.
- OpenAI confirmó disponibilidad real del modelo (HTTP 200). Una prueba independiente recibió audio generado y respuesta con estado `completed`; el ticket reutilizado fue rechazado. Estas comprobaciones de infraestructura usan identidad de diagnóstico y un bearer inválido, que no puede escribir en Supabase; no crean cuentas ni reservas ficticias en la base de datos. No sustituyen una prueba de NUNA con sesión real y su registro de consumo.
- Una prueba preliminar con límite de salida de 64 tokens quedó truncada; la siguiente con 256 tokens terminó correctamente. La configuración de la aplicación conserva su límite de 1024 tokens.
- El secreto compartido de la pasarela se rotó durante la preparación de pruebas y se guardó coincidente en Cloudflare y Vercel. No rotarlo mientras existan sesiones activas: una actualización del Worker puede interrumpirlas.
- Las 73 pruebas simuladas pasaron con Node 22.

## Regresión del temporizador de apertura — 2026-10-09

- La prueba real de duración detectó que `AbortSignal.timeout(10000)` en el fetch de actualización WebSocket de Cloudflare cerraba la conexión aproximadamente a los 11 segundos, aun después del handshake.
- Se reemplazó por un AbortController con temporizador explícito de apertura, que se limpia al resolver la conexión. El límite de 300 segundos y su alarma permanecen independientes. Se añadió una regresión automatizada que verifica la limpieza del temporizador. Las 74 pruebas pasaron con Node 22.
- Supabase confirmó mediante su configuración pública que `mailer_autoconfirm` es falso: el registro por email requiere confirmación. La API de voz de producción rechazó una petición sin sesión con HTTP 401 `login_required`.

## Resultado de la prueba de duración y entrega — 2026-10-09

- La prueba sin actividad tuvo una desconexión anormal (1006) a los 271 segundos, por lo que no se contó como validación del límite. No se atribuyó esa desconexión a una causa no demostrada.
- La prueba siguiente mantuvo actividad periódica con `input_audio_buffer.clear`, sin voz ni generaciones adicionales. El servidor cerró la conexión con código 1000 a los 301183 ms desde el inicio en el navegador, tras alcanzar el máximo de 300 segundos medido en el servidor. La pasarela cierra también el socket del proveedor; no existe una API de OpenAI consultada aquí para confirmar por separado el estado final de esa sesión.
- Después de terminar la prueba se añadió un único origen de preview explícito, no un comodín de Vercel. La comprobación real mostró 401 sin credenciales desde ese origen permitido y 403 desde un preview ajeno. Las 75 pruebas automatizadas pasaron con Node 22.
- Worker final: versión `88a1fe2f-19cc-42b7-a866-465776db8d5e`, con OPENAI_API_KEY y GATEWAY_SECRET como secretos protegidos.
- Preview construido mediante la API de Vercel a partir de los archivos versionados del checkout, excluyendo archivos no versionados: `https://nunua-cnd5kl2oa-rarevalo0306-1623.vercel.app`, despliegue `dpl_GJam4Rd3zg9V2L81jLLAE1QSsf5X`, estado READY. Fue generado desde el commit local 321504f; el código de la aplicación es el mismo y el origen permitido se configuró después en el Worker. Este preview puede pedir inicio de sesión en Vercel.
- Bloqueo de GitHub: el push del commit 321504f fue rechazado por autenticación; el acceso de lectura Git tampoco funcionó y GitHub CLI confirmó HTTP 401 Bad credentials. La última revisión confirmada en GitHub es 13b7a14. Los commits siguientes están guardados localmente; se entrega un parche recuperable. No volver a desplegar el Worker desde esa revisión antigua antes de incorporar la corrección del temporizador.
- `or-nuna.com` no se actualizó. Sigue pendiente validar el flujo completo con una cuenta real de NUNA, el registro de consumo correspondiente y recuperar la autenticación GitHub para publicar los últimos commits.
