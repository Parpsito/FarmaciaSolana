import { getStore } from "@netlify/blobs";
import { PRODUCTOS } from "./catalogo-solana.js";
const store = () => getStore({ name: "solana-admin", consistency: "strong" });
const reply = (status, body, headers={}) => Response.json(body, { status, headers });
export default async req => {
  try {
    if (req.method === "GET") {
      const s = store();
      const saved = (await s.get("data", { type: "json" })) || { precios: {}, stock: {} };
      return reply(200, { precios: saved.precios || {}, stock: saved.stock || {} }, { "Cache-Control": "no-store" });
    }
    if (req.method !== "POST") return reply(405, { error: "Método no permitido" });
    let b; try { b = await req.json(); } catch { return reply(400, { error: "JSON inválido" }); }
    const pass = process.env.ADMIN_PASSWORD;
    const got = String(b.password ?? req.headers.get("x-admin-password") ?? "");
    if (!pass) return reply(500, { error: "ADMIN_PASSWORD no está configurada en Netlify" });
    if (got !== pass) return reply(401, { error: "Contraseña incorrecta" });
    const s = store();
    if (b.orders) {
      const orders = (await getStore({ name: "solana-orders", consistency: "strong" }).get("orders", { type: "json" })) || [];
      return reply(200, { orders }, { "Cache-Control": "no-store" });
    }
    if (b.markPaid) {
      const os = getStore({ name: "solana-orders", consistency: "strong" });
      const orders = (await os.get("orders", { type: "json" })) || [];
      const order = orders.find(o => o.id === b.markPaid);
      if (!order) return reply(404, { error: "Pedido no encontrado" });
      if (order.status === "cancelled") return reply(409, { error: "El pedido está cancelado" });
      if (order.status === "paid") return reply(200, { ok: true, orders });
      if (!order.stockDeducted) {
        const saved = (await s.get("data", { type: "json" })) || { precios: {}, stock: {} };
        for (const item of order.items || []) if (saved.stock?.[item.id] !== undefined && (Number(saved.stock[item.id]) || 0) < item.quantity) return reply(409, { error: `Stock insuficiente para ${item.name}` });
        for (const item of order.items || []) if (saved.stock?.[item.id] !== undefined) saved.stock[item.id] -= item.quantity;
        await s.setJSON("data", saved); order.stockDeducted = true;
      }
      order.status = "paid"; order.manualPayment = true; order.manualPaidAt = new Date().toISOString(); order.updatedAt = order.manualPaidAt;
      await os.setJSON("orders", orders); return reply(200, { ok: true, orders });
    }
    if (b.cancelOrder) {
      const os = getStore({ name: "solana-orders", consistency: "strong" });
      const orders = (await os.get("orders", { type: "json" })) || [];
      const order = orders.find(o => o.id === b.cancelOrder);
      if (!order) return reply(404, { error: "Pedido no encontrado" });
      if (order.status === "cancelled") return reply(200, { ok: true, orders });
      const saved = (await s.get("data", { type: "json" })) || { precios: {}, stock: {} };
      if (order.stockDeducted && !order.stockRestored) {
        for (const item of order.items || []) saved.stock[item.id] = (Number(saved.stock[item.id]) || 0) + item.quantity;
        order.stockRestored = true;
        await s.setJSON("data", saved);
      }
      order.status = "cancelled"; order.updatedAt = new Date().toISOString();
      await os.setJSON("orders", orders);
      return reply(200, { ok: true, orders });
    }
    const old = (await s.get("data", { type: "json" })) || { precios: {}, stock: {} };
    if (b.check) return reply(200, { ok: true });
    if (b.load) return reply(200, { productos: PRODUCTOS, precios: old.precios || {}, stock: old.stock || {} }, { "Cache-Control": "no-store" });
    const prices = { ...(old.precios || {}) }, stock = { ...(old.stock || {}) };
    for (const [id, v] of Object.entries(b.precios || {})) {
      if (!PRODUCTOS[id]) continue;
      if (v === null || v === "") delete prices[id];
      else if (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 100000000) prices[id] = Number(v);
    }
    for (const [id, v] of Object.entries(b.stock || {})) {
      if (!PRODUCTOS[id]) continue;
      if (v === null || v === "") delete stock[id];
      else if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 999999) stock[id] = Number(v);
    }
    await s.setJSON("data", { precios: prices, stock });
    return reply(200, { ok: true, precios: prices, stock });
  } catch (e) { console.error(e); return reply(500, { error: "Error del servidor" }); }
};
