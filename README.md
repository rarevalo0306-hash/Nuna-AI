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
