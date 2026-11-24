import { getStore } from "@netlify/blobs";
import { PRODUCTOS } from "./catalogo-solana.js";
const reply=(s,b)=>Response.json(b,{status:s,headers:{"Access-Control-Allow-Origin":"*"}});
export default async req=>{
 if(req.method!=="POST") return reply(405,{error:"Método no permitido"});
 try{
  const b=await req.json(); if(!b.nombre?.trim()||!Array.isArray(b.carrito)||!b.carrito.length) return reply(400,{error:"Pedido inválido"});
  const dataStore=getStore({name:"solana-admin",consistency:"strong"}), saved=(await dataStore.get("data",{type:"json"}))||{precios:{},stock:{}};
  const items=b.carrito.map(({id,cant})=>{const p=PRODUCTOS[id],price=Number(saved.precios?.[id]);if(!p||!Number.isInteger(cant)||cant<1||cant>50)throw Error("Producto/cantidad inválido");const stock=saved.stock?.[id];if(stock!==undefined&&stock<cant)throw Error("Stock insuficiente: "+p.nombre);return {id,name:p.nombre,brand:p.marca,quantity:cant,unitPrice:Number.isFinite(price)&&price>0?price:null};});
  for(const it of items) if(saved.stock?.[it.id]!==undefined) saved.stock[it.id]-=it.quantity;
  await dataStore.setJSON("data",saved);
  const order={id:"WA-"+Date.now(),createdAt:new Date().toISOString(),name:b.nombre.trim().slice(0,100),phone:String(b.telefono||"").slice(0,40),delivery:b.entrega==="envio"?"envio":"retiro",address:String(b.direccion||"").slice(0,250),note:String(b.nota||"").slice(0,500),items,total:items.reduce((s,x)=>s+(x.unitPrice||0)*x.quantity,0),method:"WhatsApp",status:"whatsapp",stockDeducted:true,stockRestored:false};
  const os=getStore({name:"solana-orders",consistency:"strong"}), orders=(await os.get("orders",{type:"json"}))||[];orders.unshift(order);await os.setJSON("orders",orders);
  return reply(200,{ok:true,orderId:order.id});
 }catch(e){return reply(400,{error:e.message||"Error"})}
};
