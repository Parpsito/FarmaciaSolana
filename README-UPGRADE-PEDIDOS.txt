Farmacia Solana — Upgrade de pedidos e inventario

Archivos modificados:
- index.html: registra pedidos WhatsApp antes de abrir el enlace.
- admin-solana.html: segunda pestaña Compras.
- netlify/functions/admin-solana.js: listados y cancelación desde admin (restaura stock una sola vez).
- netlify/functions/crear-pago-solana.js: valida stock/precios y guarda pedido previo al checkout.
Archivos nuevos:
- netlify/functions/registrar-pedido-solana.js: registro de pedido WhatsApp y descuento de stock al registrar.
- netlify/functions/mercadopago-webhook-solana.js: consulta el pago directamente a Mercado Pago y deduce stock al estado approved.

Deploy:
1. Reemplazar los archivos de este ZIP respetando rutas.
2. Mantener variables MP_ACCESS_TOKEN, SITE_URL y ADMIN_PASSWORD.
3. En Mercado Pago, configurar/permitir notificaciones webhook al endpoint de Netlify; la función usa notification_url del checkout.
4. Desplegar y probar con productos de stock controlado.

Notas importantes:
- El checkout de Mercado Pago revalida precios y stock antes de crear la preferencia. El descuento se realiza al webhook con pago aprobado, no al retorno del navegador.
- WhatsApp: registra el pedido y descuenta el stock antes de abrir WhatsApp. Cancelar en admin restaura stock.
- La reserva/concurrencia no es transaccional: Netlify Blobs no proporciona un bloqueo de inventario multi-operación en esta implementación. En picos simultáneos, existe riesgo residual de sobreventa. Para garantía fuerte se necesita almacenamiento transaccional/lock (por ejemplo una base de datos con operaciones atómicas).
- Los pedidos Mercado Pago que queden pending/rechazados requieren revisión; no hay expiración automática de pedidos en este parche.
- La pestaña de pedidos muestra nombre, ID, productos, cantidades, totales, método, estado, entrega/dirección/notas cuando se hayan proporcionado.
