// Run against a local Firestore Emulator only. Install firebase and @firebase/rules-unit-testing separately.
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,collection,onSnapshot,runTransaction}=require('firebase/firestore');

async function run(){
 const endpoint=/^(127\.0\.0\.1|localhost):(\d+)$/.exec(process.env.FIRESTORE_EMULATOR_HOST||'');
 if(!endpoint)throw Error('Use FIRESTORE_EMULATOR_HOST=127.0.0.1:<porta local>.');
 const rules=readFileSync('firestore/nexus-orders.rules','utf8');
 const environment=await initializeTestEnvironment({projectId:'demo-nexus',firestore:{host:endpoint[1],port:Number(endpoint[2]),rules:
  'rules_version = \'2\'; service cloud.firestore { match /databases/{database}/documents { '+rules+
  ' match /sales/{id} { allow read: if nexusOperator(); allow write: if nexusOperator() && (!nexusManagedSaleId(id) || nexusManagedSaleWrite(id)); }'+
  ' match /{collection}/{id} { allow read, write: if nexusOperator() && collection in [\'products\',\'config\']; } }}'}});
 const {JSDOM}=require('jsdom');
 const page=new JSDOM('<button data-nexus-count></button><div id="modal"></div>',{runScripts:'outside-only'});
 try{
  await environment.clearFirestore();
  const store=environment.authenticatedContext('operator').firestore();
  const ref=(table,id)=>doc(store,table,id);
  const order={status:'pending',code:'A'.repeat(32),customer:'Pessoa Teste',createdAt:'2026-11-25T12:00:00.000Z',
   items:[{id:'camiseta',brand:'Marca Teste',model:'Camiseta A',size:'M',quantity:2,priceCents:8000}],notes:'',
   shippingCents:1500,subtotalCents:16000,mode:'delivery'};
  await environment.withSecurityRulesDisabled(async context=>{
   const db=context.firestore();
   await Promise.all([
    setDoc(doc(db,'nexusOperators','operator'),{active:true}),
    setDoc(doc(db,'products','camiseta'),{name:'Camiseta A',stock:7,cost:38,catalogId:'camiseta'}),
    setDoc(doc(db,'sales','historical'),{id:'historical',price:42,inst:[{v:42,paid:true}]}),
    ...['first','second','third'].map(id=>setDoc(doc(db,'nexusOrders',id),order))
   ]);
  });

  // Route the production adapter to the emulator. No Google API or storage is contacted.
  const {generateKeyPairSync}=require('node:crypto');
  const worker=(await import('../catalogo/source/worker/index.js')).default;
  const testId='3b697038-fcac-447d-a96c-7b60127c9d07';
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  const nativeFetch=global.fetch;
  global.fetch=async(url,options={})=>{
   const endpoint=new URL(url);
   if(endpoint.origin==='https://oauth2.googleapis.com')return Response.json({access_token:'owner',expires_in:3600});
   if(endpoint.origin==='https://firestore.googleapis.com')return nativeFetch('http://'+process.env.FIRESTORE_EMULATOR_HOST+endpoint.pathname+endpoint.search,options);
   if(endpoint.hostname!=='127.0.0.1'&&endpoint.hostname!=='localhost')throw Error('Rede externa bloqueada no teste.');
   return nativeFetch(url,options);
  };
  try{
   const env={ORDER_FIRESTORE_WRITER:JSON.stringify({client_email:'worker@example.invalid',private_key:privateKey}),
    ORDER_FIRESTORE_PROJECT:'demo-nexus',BUCKET:{get:async()=>({json:async()=>({
     products:[{id:'camiseta',brand:'Marca Teste',model:'Camiseta A',size:'M',price:80}],phone:'5511999999999'
    })})}};
   const valid=()=>new Request('https://catalog.example.invalid/api/orders',{
    method:'POST',headers:{origin:'https://kmimportsz.github.io','content-type':'application/json'},
    body:JSON.stringify({key:testId,mode:'pickup',name:'Pessoa Teste',items:[{id:'camiseta',quantity:2,priceCents:8000}]})
   });
   const replies=await Promise.all([worker.fetch(valid(),env),worker.fetch(valid(),env)]);
   assert.deepEqual(replies.map(r=>r.status),[201,201]);
   assert.deepEqual(await replies[0].json(),await replies[1].json());
  }finally{global.fetch=nativeFetch}
  const anon=environment.unauthenticatedContext().firestore();
  const nonOperator=environment.authenticatedContext('other').firestore();
  await assertFails(getDoc(doc(anon,'nexusOrders','first')));
  await assertFails(getDoc(doc(nonOperator,'nexusOrders','first')));
  await assertFails(setDoc(doc(nonOperator,'nexusOperators','other'),{active:true}));
  await assertFails(setDoc(ref('nexusOrders','untrusted'),order));
  const original=await getDoc(ref('sales','historical'));
  const db={
   collection(name){return {
    doc:id=>ref(name,id),
    onSnapshot:(opts,next,error)=>onSnapshot(collection(store,name),opts,snapshot=>next({
     metadata:snapshot.metadata,docs:snapshot.docs.map(d=>({id:d.id,data:()=>d.data()}))
    }),error)
   }},
   runTransaction:fn=>runTransaction(store,tx=>fn({
    async get(ref){const s=await tx.get(ref);return {exists:s.exists(),data:()=>s.data()}},set:(ref,data)=>tx.set(ref,JSON.parse(JSON.stringify(data))),update:(ref,data)=>tx.update(ref,JSON.parse(JSON.stringify(data)))
   }))
  };
  const context=page.getInternalVMContext();
  Object.assign(context,{db,au:{currentUser:{uid:'operator'}},cloudOn:true,tab:'home',unsubs:[],S:{sales:[],products:[]},
   today:()=> '2026-11-25',listen(){},pay(){},delSale(){},saleForm(){},saveSale(){},render(){},$:id=>page.window.document.getElementById(id),
   esc:String,money:String});
  vm.runInContext(readFileSync('nexus-business.js','utf8').replace('if(authenticated())listen();',
   'window.testNexus={decide,writeSale,calculate,updateStock,readProducts};if(authenticated())listen();'),context);
  const {decide,writeSale,calculate,updateStock,readProducts}=context.testNexus;
  const count=async n=>{
   for(let i=0;i<80;i++){
    if(page.window.document.querySelector('[data-nexus-count]').textContent.trim()==='('+n+')')return;
    await new Promise(r=>setTimeout(r,100));
   }
   assert.fail('Contador não sincronizou para '+n);
  };
  await count(4);
  await decide(testId,false);
  await count(3);
  await Promise.all([decide('first',true,['camiseta'],1500,1500),decide('first',true,['camiseta'],1500,1500)]);
  await decide('first',true,['camiseta'],1500,1500);
  await count(2);
  const sale=(await getDoc(ref('sales','pedido-first'))).data();
  assert.deepEqual(sale.inst,[]);
  assert.equal(sale.price,175);
  assert.equal(sale.cost,76);
  assert.equal((await getDoc(ref('products','camiseta'))).data().stock,5);
  await Promise.all([decide('second',false),decide('second',false)]);
  await count(1);
  assert.equal((await getDoc(ref('sales','pedido-second'))).exists(),false);
  assert.equal((await getDoc(ref('nexusOrders','second'))).data().status,'cancelled');
  await assert.rejects(decide('third',true,['camiseta'],1700,1500),/frete/);
  assert.equal((await getDoc(ref('nexusOrders','third'))).data().status,'pending');
  assert.equal((await getDoc(ref('products','camiseta'))).data().stock,5);
  const payment={id:'charge',v:50,d:'2026-11-28',paid:true,pd:'2026-11-25'};
  await writeSale(sale.id,1,live=>({...live,inst:[payment]}),'Cobrança registrada');
  const edit=()=>writeSale(sale.id,2,async(live,tx)=>{
   const products=await readProducts(tx,['camiseta']);
   const updated={...live,items:[{...live.items[0],quantity:1}],discountCents:500,client:'Pessoa Revisada'};
   calculate(updated);
   updated.stockAdjustment=updateStock(tx,products,live.items,updated.items);
   return updated;
  },'Venda revisada');
  const concurrent=await Promise.allSettled([edit(),edit()]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.match(concurrent.find(x=>x.status==='rejected').reason.message,/atualizada/);
  const revised=(await getDoc(ref('sales',sale.id))).data();
  assert.deepEqual(revised.inst,[payment]);
  await assertFails(setDoc(ref('sales',sale.id),{...revised,inst:[],revision:4,
   events:[...revised.events,{id:'delete-receipt',label:'Venda revisada',actor:'operator'}]}));
  await assertFails(setDoc(ref('sales',sale.id),{...revised,inst:[{...payment,v:1}],revision:4,
   events:[...revised.events,{id:'edit-receipt',label:'Cobrança revisada',actor:'operator',chargeIndex:0}]}));
  const unpaid={id:'second-charge',v:20,d:'2026-11-30',paid:false,pd:null};
  await writeSale(sale.id,3,live=>({...live,inst:[...live.inst,unpaid]}),'Cobrança registrada');
  await writeSale(sale.id,4,live=>({...live,inst:[live.inst[0],{...live.inst[1],v:25}]}),'Cobrança revisada',1);
  const charges=(await getDoc(ref('sales',sale.id))).data().inst;
  assert.deepEqual(charges,[payment,{...unpaid,v:25}]);
  assert.equal(revised.price,90);
  assert.equal(revised.cost,38);
  assert.equal((await getDoc(ref('products','camiseta'))).data().stock,6);
  assert.deepEqual((await getDoc(ref('sales','historical'))).data(),original.data());
  context.unsubs.forEach(fn=>fn());
  console.log('PASS emulador: regras, contador, confirmação e cancelamento concorrentes, retry, estoque, edição concorrente, recebimento e histórico.');
 }finally{page.window.close();await environment.cleanup()}
}
run().catch(error=>{console.error(error);process.exitCode=1});
