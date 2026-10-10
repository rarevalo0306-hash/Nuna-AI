# NUNA — nota para continuar con otra IA

Actualizada: 10 de octubre de 2026. Esta nota distingue cambios publicados, pruebas realizadas y trabajo pendiente. Antes de actuar, revisa el estado actual del repositorio y de los servicios: pueden haber cambiado después de esta fecha.

## Proyecto y decisiones del propietario

- Propietario: Ricardo. Cuenta administradora autorizada: `rarevalo0306@gmail.com`. No se conoce ni se guarda su contraseña.
- Empresa para cobros: **Orbusiness AI LLC**, registrada en Estados Unidos. Mercado previsto: Centroamérica; todavía no se eligió un primer país.
- Repositorio de esta aplicación: `https://github.com/rarevalo0306-hash/Nuna-AI`.
- Aplicación: `https://or-nuna.com`.
- Centro administrativo: `https://admin.or-nuna.com`.
- NUNA Local es un proyecto distinto: `rarevalo0306-hash/NUNA-Local`. No mezclar sus cambios con esta aplicación web.
- Ricardo no programa. Da instrucciones sencillas en español y comunica resultados concretos. Revisa credenciales existentes antes de pedir otro token. Nunca solicites claves o contraseñas en el chat.

## Qué está subido y publicado

Los cambios de la aplicación están en GitHub y Vercel. La última revisión de código antes de esta nota es `cad2cef`. El trabajo se ha guardado en `codex/bound-ai-costs` y publicado mediante avances normales a `main`, sin push forzado.

- Proyecto de Vercel: `nunua-ai` (ese es el nombre exacto).
- Project ID: `prj_j5yMbZBDqCXC0AniHluzJrkeZAaF`.
- Team ID: `team_qvuBkLdNsPMTrU31mPhnUNHn`.
- Supabase ya se utiliza para autenticación y datos personales de la aplicación. **No se ha aplicado una nueva integración administrativa o de Stripe en Supabase durante esta etapa.**
- El dominio usa DNS de Cloudflare. `admin.or-nuna.com` ya resolvía hacia Vercel, se añadió al proyecto y se comprobó HTTPS. No hizo falta cambiar registros DNS.
- El subdominio abre `admin.html` mediante una ruta condicionada por host **antes** de la resolución de archivos estáticos. El dominio principal sigue abriendo el chat. Ver `vercel.json`; una reescritura de alto nivel después del sistema de archivos no bastó para reemplazar su índice.
- Se eliminó el enlace «Abrir NUNA» de la esquina superior derecha del panel, como pidió Ricardo.
- `admin-preview.html` es un archivo previo no versionado del usuario. Se preservó sin modificar ni publicar. No borrarlo ni añadirlo accidentalmente a un commit.

## Centro administrativo: alcance real actual

Archivos: `admin.html`, `admin.css`, `admin.js`, `api/admin.js` y `tests/admin.test.cjs`.

- Entrada real con email y contraseña de Supabase; sesión separada en el navegador mediante `nuna-admin-auth`.
- `GET /api/admin` exige identidad validada por Supabase, email confirmado y pertenencia a `NUNA_ADMIN_EMAILS`, comprobada en el servidor. Reutiliza la identidad ya verificada; no confía en emails o roles enviados por el navegador.
- Invitados reciben 401; cuentas normales reciben 403. No se permite administrar cambiando el HTML o un JWT sin validar.
- Ricardo confirmó que pudo entrar al panel.
- Navegación preparada: Resumen, Usuarios, Planes y rentabilidad, Uso y costos, Facturación y Permisos.
- **Estas secciones todavía NO consultan datos globales del negocio ni permiten cambiar cuentas, planes, roles o cobros.** Están identificadas como pendientes de conexión. No hay estadísticas ficticias presentadas como reales.
- Las variables de Production revisadas tenían URL y clave pública de Supabase, más la lista de administradores. No había una credencial de administración global de Supabase. Revisa de nuevo antes de pedir configuración: una futura implementación puede usar funciones y permisos adecuados, sin entregar credenciales privilegiadas al navegador.

El centro debe permitir gestionar usuarios gratuitos y de pago, comparar qué incluye cada plan, precio de venta, costo real y margen. Los permisos y cada operación administrativa deberán validarse en el servidor o la base de datos, con registro de cambios cuando se implementen.

## Cobros: decisión y siguiente trabajo

**Se decidió usar Stripe con Link habilitado, empezando en Sandbox. La integración todavía NO está programada, conectada ni publicada.**

- Ricardo tiene una cuenta de Stripe para otro negocio. Se le explicó que puede usar el mismo inicio de sesión para varias cuentas comerciales, y crear una cuenta adicional para Orbusiness AI LLC. No confirmó aún que haya terminado esa creación.
- Cada negocio debe conservar sus propios datos fiscales, pagos, saldos y cuenta bancaria. No mezclar cobros con la cuenta del otro negocio.
- Link es el checkout acelerado de Stripe, no un procesador independiente ni un sustituto de todos los métodos locales centroamericanos.
- Plan Gratis sin exigir tarjeta. Planes de pago con suscripciones; cobros de publicidad para Work en una fase posterior.
- Precios, frecuencia mensual/anual, límites y condiciones comerciales finales aún no están aprobados. No inventarlos como decisiones del propietario.
- Stripe Connect solo se evaluaría después si NUNA cobra servicios y paga a profesionales. No es parte de esta primera integración.
- Stripe no actúa aquí como vendedor legal/Merchant of Record; la empresa conserva sus obligaciones tributarias. No prometer que aceptar tarjetas cubre todos los métodos locales de Centroamérica.

Próximo trabajo propuesto, cuando Ricardo pida continuar:

1. Confirmar la cuenta de Stripe correcta y crear/usar su Sandbox. Inspeccionar configuraciones existentes antes de solicitar claves nuevas.
2. Acordar planes y precios. Preparar esquema seguro de suscripciones y relación entre identidad de Supabase y cliente de Stripe.
3. Implementar Checkout y portal de clientes desde el servidor, usando claves de prueba. Precios, derechos y cambios de plan deben resolverse en el servidor.
4. Implementar webhook con verificación de firma, procesamiento idempotente y sincronización de suscripciones. No conceder un plan por la URL de retorno ni por datos del navegador.
5. Probar pago exitoso, rechazado, renovación, cancelación, eventos repetidos y acceso de cada plan. Tarjeta de prueba habitual: 4242 4242 4242 4242, exclusivamente en Sandbox.
6. Mostrar resultados reales de pruebas en el panel administrativo; distinguir ingresos, costos estimados/medidos y margen. No presentar cifras de Sandbox como ingresos reales.

No activar cobros reales, comprar servicios ni modificar la cuenta del otro negocio como consecuencia de esta nota. La petición actual es dejar continuidad, no activar Stripe.

## Voz, imágenes y videos: estado que no debe perderse

- Voz: OpenAI Realtime, voz femenina **Marin**. El modelo configurado por defecto en el código es `gpt-realtime-2.1`; revisar variables actuales antes de afirmar el modelo efectivo.
- NUNA saluda primero al abrir una nueva sesión de voz. Habla con cariño y naturalidad, como amiga y asistente, y usa el nombre conocido del usuario sin inventarlo ni deducirlo del email.
- Su pez cristiano representa «Jesucristo, Hijo de Dios, Salvador» y se usa para compartir amor, esperanza y salvación de Cristo. Explicarlo naturalmente, sin mencionar instrucciones internas. La última preferencia fue **no añadir versículos automáticamente al explicar el logo**, salvo solicitud explícita; esto reemplaza la petición anterior de citar siempre un versículo.
- No exponer al usuario normal los modelos/proveedores internos. Conservar turquesa, azul oscuro y diseño adaptable.
- Todos los accesos a IA requieren registro y email confirmado. No reabrir accesos anónimos mediante códigos privados.
- El gateway de voz limita las sesiones en el servidor; no sustituirlo por un límite exclusivamente del navegador. No rotar sus secretos ni publicar una versión antigua sin revisar `SEGURIDAD-COSTOS.md`.
- Imágenes predeterminadas: `NUNA_IMAGE_ENGINE=openai`. La cuenta de fal.ai devolvió rechazo por cuenta bloqueada; una prueba real de OpenAI generó un JPEG válido.
- Videos predeterminados: `NUNA_VIDEO_ENGINE=grok`. Se comprobaron dos generaciones reales y descarga de MP4: texto a video e imagen a video. Se usaron credenciales existentes de Production dentro de builds privados de diagnóstico que fallaron intencionadamente para no sustituir la web.
- Conservar `FAL_KEY`: también interviene en la clave de cifrado de trabajos antiguos. Borrarla o cambiar el orden de selección de claves puede impedir recuperar esos trabajos.
- Extender videos sigue utilizando fal.ai y **no está verificado como operativo** con una cuenta habilitada.
- La voz dispone de `create_video`. Un trabajo aceptado se anuncia como pendiente, nunca como archivo ya entregado. Se recupera el mismo trabajo ante fallos de descarga/guardado para evitar otra generación y cargos duplicados.
- Se corrigió la confusión de «animal», «animado» y «animated» con una petición de animar una foto. Ver `video-intent.js` y `use_latest_image` de la herramienta de voz.
- Ricardo reportó que un video no le llegó. Se publicaron correcciones de intención y entrega, pero **no confirmó después que ese flujo completo funcionara desde su sesión**. No confundir las pruebas reales del proveedor con micrófono → solicitud → generación → almacenamiento → visualización en su cuenta.
- Descarga y compartir usan iconos SVG; no restaurar las flechas/textos antiguos.

## Verificación y archivos útiles

- Antes de esta nota, pasaron **92 pruebas automatizadas con Node 22**:
  `npx --yes --package=node@22 node --test tests/*.test.cjs tests/*.test.mjs`
- Se comprobó el panel en navegador, sin errores de JavaScript, inicio de sesión disponible y adaptación móvil sin desbordamiento horizontal. Se comprobó que su API rechaza invitados.
- El dominio principal siguió mostrando el chat y el subdominio pasó a mostrar administración.
- Detalles históricos, limitaciones y pruebas: `SEGURIDAD-COSTOS.md`. Es un registro cronológico; las entradas posteriores pueden corregir estados antiguos.
- Consultar `supabase/migrations/`, `api/_plans.js` y `api/_supabase.js` para los límites y permisos actuales, sin copiar valores viejos o asumir que todas las migraciones del repositorio están aplicadas.
- No incluir claves, conversaciones, datos privados de usuarios ni modelos descargados en GitHub. Las credenciales disponibles pueden estar vinculadas al proxy del entorno; comprobar operaciones con esos accesos antes de pedir tokens.
