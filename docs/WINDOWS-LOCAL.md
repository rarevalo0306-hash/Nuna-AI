# Qwen privado desde NUNA Local en Windows

El selector **Qwen** usa NUNA Local solo para la cuenta verificada indicada por
`NUNA_LOCAL_QWEN_EMAIL`. Conserva la sesión Supabase, la reserva de cuota y los
otros proveedores. No admite el código de administrador como sustituto de esa cuenta.

Variables privadas del servidor en Vercel:

- `NUNA_LOCAL_QWEN_URL`: enlace HTTPS del motor de Windows (origen, sin `/v1`).
- `NUNA_LOCAL_QWEN_KEY`: clave de **API externa** de Servidor NUNA; tipo Secret.
- `NUNA_LOCAL_QWEN_MODEL`: `unsloth/Qwen3.5-9B-GGUF` para el modelo instalado.
- `NUNA_LOCAL_QWEN_EMAIL`: conserva la cuenta permitida existente.
- `NUNA_LOCAL_QWEN_FALLBACK=false` (también vale `FALSE`, `0`, `no` u `off`): si la PC no responde, la configuración falla,
  el contexto es muy largo o la respuesta se corta, muestra un error y devuelve
  la cuota; no llama al proveedor de pago para esa cuenta. Otras cuentas siguen
  usando el proveedor que ya tenían configurado.

La llamada a Windows incluye modelo, mensajes, máximo 2048 tokens y `stream:false`, y pide responder sin fase de
razonamiento (`reasoning_effort:'none'` y `chat_template_kwargs.enable_thinking=false`, como hacía el puente del Mac).
Si el motor rechaza esas opciones (400 o 422), se repite una vez sin ellas. Un bloque `<think>…</think>` nunca se
muestra. Los fragmentos de documentos se recortan para caber en el contexto local; la conversación no. La espera
se ajusta al tiempo que le queda a la función (90 s en total) para poder devolver la cuota si la PC no responde.
El chat muestra «Respuesta de Qwen en tu PC» únicamente cuando el servidor obtiene
una respuesta real del endpoint local. No afirma éxito al recibir un error.

El motor debe estar encendido y conectado. Un enlace temporal `trycloudflare.com`
cambia al recrear el túnel; en ese caso actualiza la URL y vuelve a desplegar.
Para funcionamiento permanente, configura antes una dirección fija. La API externa
solo expone modelos y generación; no expone la administración ni el historial de la PC.

Pruebas: `node --test tests/*.test.cjs`. Los tests de Windows comprueban el contrato
HTTP, aislamiento de cuenta y devolución de cuota sin llamadas a proveedores de pago.
