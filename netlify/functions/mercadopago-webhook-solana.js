import { getStore } from "@netlify/blobs";
export default async req=>{
 try{
  const url=new URL(req.url), paymentId=url.searchParams.get("id")||url.searchParams.get("data.id");
  if(!paymentId||!process.env.MP_ACCESS_TOKEN)return new Response("Missing",{status:400});
  const mp=await fetch("https://api.mercadopago.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Bearer "+process.env.MP_ACCESS_TOKEN}});
  if(!mp.ok)return new Response("Payment lookup failed",{status:502});
  const pay=await mp.json(), ref=pay.external_reference;
  if(!ref)return new Response("No reference",{status:200});
  const os=getStore({name:"solana-orders",consistency:"strong"}),orders=(await os.get("orders",{type:"json"}))||[],order=orders.find(o=>o.id===ref);
  if(!order)return new Response("Unknown order",{status:200});
  if(pay.status==="approved"&&!order.stockDeducted){
   const ds=getStore({name:"solana-admin",consistency:"strong"}),data=(await ds.get("data",{type:"json"}))||{precios:{},stock:{}};
   for(const item of order.items)if(data.stock?.[item.id]!==undefined)data.stock[item.id]-=item.quantity;
   await ds.setJSON("data",data);order.stockDeducted=true;order.status="paid";
  }else if(pay.status==="approved")order.status="paid";
  else if(pay.status==="pending"||pay.status==="in_process")order.status="pending";
  else if(["rejected","cancelled"].includes(pay.status))order.status=pay.status;
  order.paymentId=String(paymentId);order.updatedAt=new Date().toISOString();await os.setJSON("orders",orders);
  return new Response("ok",{status:200});
 }catch(e){console.error(e);return new Response("error",{status:500})}
};
