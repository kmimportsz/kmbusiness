import assert from 'node:assert/strict';
import {registerOrder} from '../worker/orders.js';
const db=new Map();
const store={
 async get(id){return db.get(id)},
 async create(id,row){if(db.has(id))return false;db.set(id,row);return true}
};
const catalog={products:[{id:'camiseta',brand:'Marca fictícia',model:'Camiseta A',size:'M',price:80}],phone:'5511999999999'};
const body={key:crypto.randomUUID(),name:'Pessoa Teste',mode:'delivery',address:{cep:'01001000',street:'Rua Fictícia',number:'12'},items:[{id:'camiseta',quantity:2,priceCents:8000}]};
let fee=1500;
const send=data=>registerOrder(data,store,async()=>catalog,async()=>fee);
const [first,parallel]=await Promise.all([send(body),send(body)]);
assert.deepEqual(parallel,first);
assert.equal(db.size,1);
assert.equal(first.subtotalCents,16000);
assert.equal(first.shippingCents,1500);
assert.equal(first.address.reference,'');
assert.match(first.code,/^[0-9A-F]{32}$/);
assert.equal(db.get(body.key).status,'pending');
assert.ok(!('requestHash' in first));
fee=2000;
assert.deepEqual(await send(body),first,'Lost response recovery keeps the first recorded fee');
await assert.rejects(send({...body,name:'Cliente Diferente'}),{status:409});
await assert.rejects(send({...body,key:crypto.randomUUID(),items:[{...body.items[0],priceCents:6000}]}),{status:409});
await assert.rejects(send({...body,key:crypto.randomUUID(),items:[...body.items,...body.items]}),{status:400});
const newFee=await send({...body,key:crypto.randomUUID()});
assert.equal(newFee.shippingCents,2000);
console.log('PASS pedidos: catálogo autoritativo, concorrência, resposta perdida, frete, dados públicos e deduplicação.');
