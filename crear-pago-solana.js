// Netlify Function: crear preferencia de Mercado Pago para Farmacia Solana.
// Requiere MP_ACCESS_TOKEN, SITE_URL y precios cargados en precios-solana.json.
import catalogo from "./precios-solana.js";
import { getStore } from "@netlify/blobs";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const responder = (status, body) => new Response(JSON.stringify(body), { status, headers });

export default async (request) => {
  if (request.method !== "POST") return responder(405, { error: "Método no permitido" });
  try {
    const token = process.env.MP_ACCESS_TOKEN, site = process.env.SITE_URL;
    if (!token || !site) return responder(500, { error: "Falta configurar MP_ACCESS_TOKEN o SITE_URL." });
    const { carrito, nombre, entrega, direccion, nota } = await request.json();
    const saved = (await getStore({ name: "solana-admin", consistency: "strong" }).get("data", { type: "json" })) || {};
    const precios = saved.precios || {};
    if (!nombre?.trim() || !Array.isArray(carrito) || !carrito.length || carrito.length > 100) return responder(400, { error: "Pedido o nombre inválido." });
    if (entrega === "envio" && !direccion?.trim()) return responder(400, { error: "Falta la dirección de envío." });
    const items = carrito.map(({ id, cant }) => {
      if (!Number.isInteger(id) || !Number.isInteger(cant) || cant < 1 || cant > 50) throw new Error("Cantidad o producto inválido.");
      const p = catalogo[id]; const precio = Number(precios[id] ?? p?.precio); if (!p || p.id !== id || !Number.isFinite(precio) || precio <= 0) throw new Error(`Precio pendiente de configurar: producto ${id}.`);
      const disponible = saved.stock?.[id]; if (disponible !== undefined && disponible < cant) throw new Error(`Stock insuficiente: ${p.nombre}.`);
      return { title: `${p.marca} ${p.nombre}`, quantity: cant, unit_price: precio, currency_id: "ARS" };
    });
    const body = { items, external_reference: `solana-${Date.now()}`, metadata: { nombre: nombre.trim().slice(0,100), entrega: entrega === "envio" ? "envio" : "retiro", direccion: (direccion || "").trim().slice(0,250), nota: (nota || "").trim().slice(0,500) }, back_urls: { success: `${site}/?pago=ok`, pending: `${site}/?pago=pendiente`, failure: `${site}/?pago=error` }, auto_return: "approved" };
    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await mp.json(); if (!mp.ok) return responder(mp.status, { error: data.message || "Mercado Pago rechazó la preferencia." });
    return responder(200, { link: data.init_point, ref: data.id });
  } catch (e) { return responder(400, { error: e.message || "Error al crear el checkout." }); }
};
