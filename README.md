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
