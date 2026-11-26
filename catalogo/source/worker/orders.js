class OrderError extends Error {
 constructor(message,status=400){super(message);this.status=status}
}
const orderIdentifier=/^[a-zA-Z0-9_-]{1,128}$/;
const orderKey=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const orderMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const orderText=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const orderBase64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const orderEncode=s=>orderBase64(new TextEncoder().encode(s));
function orderValue(value){
 if(value===null)return {nullValue:null};
 if(Array.isArray(value))return {arrayValue:{values:value.map(orderValue)}};
 if(typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,orderValue(v)]))}};
 if(typeof value==='number')return {integerValue:String(value)};
 return {stringValue:value};
}
function orderDecode(v){
 if('nullValue'in v)return null;
 if('integerValue'in v)return Number(v.integerValue);
 if('arrayValue'in v)return (v.arrayValue.values||[]).map(orderDecode);
 if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,orderDecode(x)]));
 return v.stringValue;
}
let orderTokenCache;
async function orderGoogleToken(env){
 const raw=env.ORDER_FIRESTORE_WRITER;
 if(!raw)throw new OrderError('Registro de pedidos temporariamente indisponível.',503);
 const credential=JSON.parse(raw);
 if(credential?.type==='staging_access_token'){
  const remaining=credential.expiresAt-Date.now();
  if(env.ORDER_FIRESTORE_PROJECT!=='km-business-homologacao'
    ||typeof credential.accessToken!=='string'||!/^[A-Za-z0-9._~+\/=\-]+$/.test(credential.accessToken)
    ||!Number.isSafeInteger(credential.expiresAt)||remaining<=0||remaining>3600000){
   throw new OrderError('Registro de pedidos temporariamente indisponível.',503);
  }
  return credential.accessToken;
 }
 const account=env.ORDER_FIRESTORE_PROJECT+':'+credential.client_email;
 if(orderTokenCache?.account===account&&orderTokenCache.expires>Date.now()+60000)return orderTokenCache.token;
 const now=Math.floor(Date.now()/1000);
 const message=orderEncode(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+orderEncode(JSON.stringify({
  iss:credential.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600
 }));
 const key=Uint8Array.from(atob(credential.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
 const signer=await crypto.subtle.importKey('pkcs8',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signer,new TextEncoder().encode(message));
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({
  grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:message+'.'+orderBase64(new Uint8Array(signature))
 }),signal:AbortSignal.timeout(8000)});
 const body=await res.json();
 if(!res.ok||!body.access_token)throw new OrderError('Registro de pedidos temporariamente indisponível.',503);
 orderTokenCache={account,token:body.access_token,expires:Date.now()+body.expires_in*1000};
 return body.access_token;
}
export function orderStore(env){
 const project=env.ORDER_FIRESTORE_PROJECT;
 if(!/^[a-z][a-z0-9-]{4,29}$/.test(project||''))throw new OrderError('Registro de pedidos temporariamente indisponível.',503);
 const url='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/nexusOrders';
 async function call(path,opts={}){
  return fetch(url+path,{...opts,headers:{authorization:'Bearer '+await orderGoogleToken(env),'content-type':'application/json'},signal:AbortSignal.timeout(8000)});
 }
 return {
  async get(key){
   const r=await call('/'+key);
   if(r.status===404)return null;
   if(!r.ok)throw new OrderError('Não foi possível consultar o pedido. Tente novamente.',503);
   return orderDecode({mapValue:await r.json()});
  },
  async create(key,entry){
   const r=await call('?documentId='+key,{method:'POST',body:JSON.stringify(orderValue(entry).mapValue)});
   if(r.status===409)return false;
   if(!r.ok)throw new OrderError('Não foi possível registrar o pedido. Tente novamente.',503);
   return true;
  }
 };
}
export async function registerOrder(body,store,getCatalog,quoteDelivery){
 if(!body||!orderKey.test(body.key||'')||!Array.isArray(body.items)||body.items.length<1||body.items.length>30||body.website)throw new OrderError('Confira a sacola.');
 const mode=body.mode,name=orderText(body.name,120),notes=orderText(body.notes,500);
 if(name.length<3||!['pickup','delivery'].includes(mode))throw new OrderError('Confira o nome e a forma de recebimento.');
 const address=mode==='delivery'?Object.fromEntries(Object.entries({cep:8,street:160,number:10,reference:180}).map(([field,max])=>[field,orderText(body.address?.[field],max)])):null;
 if(address&&(!/^\d{8}$/.test(address.cep)||address.street.length<3||!/^\d{1,6}[A-Za-z]?$/.test(address.number)))throw new OrderError('Confira o endereço.');
 const items=body.items.map(x=>{
  if(!x||typeof x.id!=='string'||!orderIdentifier.test(x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99||!orderMoney(x.priceCents))throw new OrderError('Confira os itens.');
  return {id:x.id,quantity:x.quantity,priceCents:x.priceCents};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(items.map(x=>x.id)).size!==items.length)throw new OrderError('Confira os itens repetidos.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({mode,name,notes,address,items})));
 const hash=orderBase64(new Uint8Array(digest));
 const result=entry=>{
  if(entry.requestHash!==hash)throw new OrderError('Esta tentativa já pertence a outro pedido.',409);
  const {code,customer,mode,address,notes,items,subtotalCents,shippingCents,phone}=entry;
  return {code,customer,mode,address,notes,items,subtotalCents,shippingCents,phone};
 };
 const existing=await store.get(body.key);
 if(existing)return result(existing);
 const catalog=await getCatalog();
 const reviewed=items.map(x=>{
  const p=catalog.products.find(p=>p.id===x.id);
  if(!p||p.available===false)throw new OrderError('Um item ficou indisponível. Revise a sacola.',409);
  const priceCents=Math.round(p.price*100);
  if(!orderMoney(priceCents)||priceCents!==x.priceCents)throw new OrderError('O preço mudou. Revise a sacola.',409);
  return {...x,brand:orderText(p.brand,80),model:orderText(p.model,100),size:orderText(p.size,60)};
 });
 const fee=address?await quoteDelivery(address):0;
 const entry={
  code:body.key.replace(/-/g,'').toUpperCase(),requestHash:hash,status:'pending',createdAt:new Date().toISOString(),
  customer:name,mode,address,notes,items:reviewed,subtotalCents:reviewed.reduce((sum,x)=>sum+x.quantity*x.priceCents,0),
  shippingCents:orderMoney(fee)?fee:null,phone:/^\d{10,15}$/.test(catalog.phone)?catalog.phone:''
 };
 if(await store.create(body.key,entry))return result(entry);
 const winner=await store.get(body.key);
 if(!winner)throw new OrderError('Tente consultar o pedido novamente.',503);
 return result(winner);
}
async function readOrderBody(req){
 const limit=16000;
 if(Number(req.headers.get('content-length'))>limit)throw new OrderError('Pedido muito longo.',413);
 if(!req.body)throw new OrderError('Confira os dados do pedido.');
 const reader=req.body.getReader(),decoder=new TextDecoder();
 let size=0,text='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>limit){await reader.cancel();throw new OrderError('Pedido muito longo.',413)}
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock()}
}
export async function orderEndpoint(req,env,{headers,reply},getCatalog,quoteDelivery){
 try{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST'||!req.headers.get('content-type')?.startsWith('application/json'))throw new OrderError('Envio inválido.',405);
  if(!req.headers.get('origin')||req.headers.get('origin')!==headers['access-control-allow-origin'])throw new OrderError('Origem inválida.',403);
  const raw=await readOrderBody(req);
  let body;
  try{body=JSON.parse(raw)}catch{throw new OrderError('Confira os dados do pedido.')}
  return reply(await registerOrder(body,orderStore(env),getCatalog,quoteDelivery),201);
 }catch(error){
  return reply({error:error instanceof OrderError?error.message:'Não foi possível confirmar o registro. Tente novamente.'},error.status||503);
 }
}
