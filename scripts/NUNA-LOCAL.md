# NUNA Local — conexión de prueba

Selecciona **NUNA Local** en Configuración → Modelos. Las solicitudes de ese chat van al motor local; un error no activa un proveedor de pago. Imágenes locales se generan desde la aplicación de escritorio, por separado. Voz y video conservan sus integraciones existentes y no se consideran funciones del motor local.

Configura solo en el servidor, inicialmente en Preview y en la rama `codex/nuna-local-web`:

- `NUNA_LOCAL_URL`: URL HTTPS del conector de NUNA Local.
- `NUNA_LOCAL_KEY`: clave de integración del Llavero; nunca colocar en el navegador.
- `NUNA_LOCAL_ALLOWED_USERS`: UUID de cuentas Supabase autorizadas, separados por comas. Por defecto ninguna cuenta tiene acceso.
- El código privado del administrador permite probar sin sesión de cliente. Cada sesión de cliente se verifica mediante Supabase Auth; nunca se toma el dueño de la petición del navegador.

Las firmas incluyen cuenta, método, ruta, cuerpo, marca de tiempo y nonce. El servidor rechaza repetición de la firma, aisla consultas por cuenta y restringe operaciones remotas. El cliente envía una `Idempotency-Key` para evitar doble generación. Máximo 45 segundos desde la web; la aplicación tiene su propio límite de cola y por cuenta.

La conexión temporal de Cloudflare cambia de URL al reabrirse, se apaga al cerrar y no admite SSE. Para clientes es necesario un túnel permanente y luego autorizar el lanzamiento de esta integración en producción. No se ejecutan cambios de base de datos.

Pruebas: `node --test tests/*.test.cjs`. La prueba real `scripts/test-local-real.cjs` requiere las variables de servidor en su entorno y escribe un informe sin claves.
