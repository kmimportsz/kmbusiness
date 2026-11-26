// Run against a local Firestore Emulator only. Install firebase and @firebase/rules-unit-testing separately.
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,getDocs,setDoc,deleteDoc,collection,onSnapshot,runTransaction,serverTimestamp,writeBatch}=require('firebase/firestore');

async function run(){
 const endpoint=/^(127\.0\.0\.1|localhost):(\d+)$/.exec(process.env.FIRESTORE_EMULATOR_HOST||'');
 if(!endpoint)throw Error('Use FIRESTORE_EMULATOR_HOST=127.0.0.1:<porta local>.');
 const emails=['admin-one@example.invalid','admin-two@example.invalid'];
 const rules=readFileSync('firestore/nexus-orders.rules','utf8')
  .replace('__ADMIN_EMAIL_1__',emails[0]).replace('__ADMIN_EMAIL_2__',emails[1]);
 const environment=await initializeTestEnvironment({projectId:'demo-nexus',firestore:{host:endpoint[1],port:Number(endpoint[2]),rules}});
 const {JSDOM}=require('jsdom');
 const page=new JSDOM('<button data-nexus-count></button><div id="modal"></div>',{runScripts:'outside-only'});
 try{
  await environment.clearFirestore();
  const store=environment.authenticatedContext('operator',{email:emails[0]}).firestore();
  const secondAdmin=environment.authenticatedContext('second-admin',{email:emails[1]}).firestore();
  const legacyOnly=environment.authenticatedContext('legacy-only',{email:emails[1]}).firestore();
  const ref=(table,id)=>doc(store,table,id);
  const order={status:'pending',code:'A'.repeat(32),customer:'Pessoa Teste',createdAt:'2026-11-25T12:00:00.000Z',
   items:[{id:'camiseta',brand:'Marca Teste',model:'Camiseta A',size:'M',quantity:2,priceCents:8000}],notes:'',
   shippingCents:1500,subtotalCents:16000,mode:'delivery'};
  await environment.withSecurityRulesDisabled(async context=>{
   const db=context.firestore();
   await Promise.all([
    setDoc(doc(db,'nexusOperators','operator'),{active:true}),
    setDoc(doc(db,'nexusOrderControl','intake'),{enabled:true}),
    setDoc(doc(db,'nexusOperators','second-admin'),{active:true}),
    setDoc(doc(db,'nexusOperators','unlisted'),{active:true}),
    setDoc(doc(db,'products','camiseta'),{name:'Camiseta A',stock:7,cost:38,price:80,catalogId:'camiseta'}),
    setDoc(doc(db,'sales','historical'),{id:'historical',price:42,inst:[{v:42,paid:true}]}),
    ...['first','second','third'].map(id=>setDoc(doc(db,'nexusOrders',id),order))
   ]);
  });

  const testId='3b697038-fcac-447d-a96c-7b60127c9d07';
  await environment.withSecurityRulesDisabled(async context=>{
   await setDoc(doc(context.firestore(),'nexusOrders',testId),order);
  });
  const anon=environment.unauthenticatedContext().firestore();
  const nonOperator=environment.authenticatedContext('other').firestore();
  await assertFails(getDoc(doc(anon,'nexusOrders','first')));
  await assertFails(getDoc(doc(nonOperator,'nexusOrders','first')));
  await assertFails(setDoc(doc(nonOperator,'nexusOperators','other'),{active:true}));
  await assertFails(setDoc(ref('nexusOrders','untrusted'),order));
  const unlisted=environment.authenticatedContext('unlisted',{email:'unlisted@example.invalid'}).firestore();
  await assertFails(getDoc(doc(unlisted,'nexusOrders','first')));
  await assertFails(getDoc(doc(unlisted,'products','camiseta')));
  await assertFails(getDoc(doc(legacyOnly,'nexusOrders','first')));
  assert.equal((await getDocs(collection(legacyOnly,'sales'))).size,1);
  assert.equal((await getDocs(collection(secondAdmin,'nexusOrders'))).size,4);
  for(const admin of [store,secondAdmin]){
   for(const table of ['products','sales','catalog','cphotos','expenses','closings','config','proofs']){
    const legacy=doc(admin,table,'legacy-permission-check');
    const stock=table==='products'?{stock:0,stockRevision:1}:{};
    await setDoc(legacy,{...stock,value:1});await setDoc(legacy,{...stock,value:2});
    assert.equal((await getDoc(legacy)).data().value,2);
    if(table==='products'){
     await assertFails(deleteDoc(legacy));
     await runTransaction(admin,async tx=>{
      tx.delete(legacy);
      tx.set(doc(admin,'config','nexus-stock-deletion'),{actor:admin===store?'operator':'second-admin',
       at:serverTimestamp(),revisions:{'legacy-permission-check':1}});
     });
    }else await deleteDoc(legacy);
   }
   await assertFails(getDoc(doc(admin,'nexusOperators','operator')));
   await assertFails(setDoc(doc(admin,'nexusOperators','self-grant'),{active:true}));
   await assertFails(setDoc(doc(admin,'nexusOperators','operator','nested','x'),{active:true}));
   await assertFails(setDoc(doc(admin,'nexusOrders','first','nested','x'),{status:'confirmed'}));
   await assertFails(deleteDoc(doc(admin,'nexusOrders','first')));
   await assertFails(setDoc(doc(admin,'sales','pedido-first'),{id:'pedido-first',source:'catalog',orderId:'first'}));
  }
  const legacyNested=doc(secondAdmin,'sales','historical','notes','compatibility');
  await setDoc(legacyNested,{text:'fixture'});
  assert.equal((await getDoc(legacyNested)).data().text,'fixture');
  await deleteDoc(legacyNested);
  await assertFails(setDoc(doc(anon,'products','camiseta'),{stock:1}));
  await assertFails(setDoc(doc(unlisted,'sales','historical'),{price:1}));
  const original=await getDoc(ref('sales','historical'));
  const adapter=firestore=>({
   collection(name){return {
    doc:id=>doc(firestore,name,id),
    onSnapshot:(opts,next,error)=>onSnapshot(collection(firestore,name),opts,snapshot=>next({
     metadata:snapshot.metadata,docs:snapshot.docs.map(d=>({id:d.id,data:()=>d.data()}))
    }),error)
   }},
   runTransaction:fn=>runTransaction(firestore,tx=>fn({
    async get(ref){const s=await tx.get(ref);return {exists:s.exists(),data:()=>s.data()}},set:(ref,data)=>{
     const clean=JSON.parse(JSON.stringify(data));
     if(ref.id==='nexus-stock-deletion')clean.at=serverTimestamp();
     return tx.set(ref,clean);
    },delete:ref=>tx.delete(ref),update:(ref,data)=>tx.update(ref,JSON.parse(JSON.stringify(data)))
   }))
  });
  const main=readFileSync('index.html','utf8');
  const stockHelper=main.slice(main.indexOf('async function runStockTransaction'),main.indexOf('function cloudSave('));
  const context=page.getInternalVMContext();
  Object.assign(context,{db:adapter(store),au:{currentUser:{uid:'operator'}},cloudOn:true,tab:'home',unsubs:[],S:{sales:[],products:[]},
   today:()=> '2026-11-25',listen(){},pay(){},delSale(){},saleForm(){},saveSale(){},render(){},$:id=>page.window.document.getElementById(id),
   esc:String,money:String});
  vm.runInContext(stockHelper,context);
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
  assert.ok((await getDocs(collection(secondAdmin,'sales'))).docs.some(d=>d.id===sale.id));
  await assertFails(deleteDoc(doc(secondAdmin,'sales',sale.id)));
  await assertFails(setDoc(doc(secondAdmin,'sales',sale.id,'nested','x'),{x:1}));
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
  const cancelThird={...order,status:'cancelled',decidedBy:'second-admin',decidedAt:'2026-11-25T12:01:00.000Z'};
  await assertFails(setDoc(doc(legacyOnly,'nexusOrders','third'),{...cancelThird,decidedBy:'legacy-only'}));
  await setDoc(doc(secondAdmin,'nexusOrders','third'),cancelThird);
  await count(0);
  await environment.withSecurityRulesDisabled(async context=>{
   await setDoc(doc(context.firestore(),'nexusOrders','stock-race'),order);
  });
  const stockPage=new JSDOM('',{runScripts:'outside-only'});
  try{
   const stockContext=stockPage.getInternalVMContext(),warnings=[];
   Object.assign(stockContext,{firebase:{firestore:{FieldValue:{serverTimestamp}}},db:adapter(secondAdmin),au:{currentUser:{uid:'second-admin',email:emails[1]}},
    cloudOn:true,ready:{products:true,config:true},last:{products:{},config:{}},S:{products:[{id:'camiseta'}],config:[]},
    KEY:'isolated-test',tab:'home',render(){},alert:message=>warnings.push(message),console:{error(){}},$:()=>({innerHTML:''})});
   vm.runInContext(stockHelper,stockContext);
   vm.runInContext(readFileSync('inventory3.js','utf8')
    .replace('const previousRender=render;', 'window.testCommitStock=commitStock;const previousRender=render;'),stockContext);
   const productRef=doc(secondAdmin,'products','camiseta');
   const seen=[];
   const stops=[
    onSnapshot(productRef,s=>{if(s.exists())seen.push(['stock',s.data().stock])}),
    onSnapshot(doc(secondAdmin,'sales','pedido-stock-race'),s=>{if(s.exists())seen.push(['sale',s.data().inst.length])}),
    onSnapshot(doc(secondAdmin,'nexusOrders','stock-race'),s=>{if(s.exists())seen.push(['order',s.data().status])})
   ];
   try{
    const stale={...(await getDoc(productRef)).data(),id:'camiseta'};
    const inbound={id:'test-inbound',kind:'inbound',reason:'Teste isolado',items:[{pid:'camiseta',qty:3,cost:38}]};
    await Promise.all([decide('stock-race',true,['camiseta'],1500,1500),stockContext.testCommitStock(inbound)]);
    await stockContext.testCommitStock(inbound);
    assert.equal((await getDoc(productRef)).data().stock,7);
    await assertFails(setDoc(productRef,{...stale,stock:10}));
    await assert.rejects(stockContext.commitProductChanges([{id:'camiseta',before:stale,after:{...stale,stock:10}}]),/mudou em outra sessão/);
    await assert.rejects(stockContext.commitProductChanges([{id:'camiseta',before:stale,after:null}]),/mudou em outra sessão/);
    stockContext.S.products=[{...stale,stock:10}];
    stockContext.last.products={camiseta:JSON.stringify(stale)};
    await stockContext.syncLegacyProducts();
    assert.match(warnings.at(-1),/mudou em outra sessão/);
    assert.equal(stockContext.S.products[0].stock,7);
    const removable={id:'remove-fresh',name:'Fixture removível',stock:0};
    await stockContext.commitProductChanges([{id:removable.id,before:null,after:removable}]);
    const fresh=(await getDoc(doc(secondAdmin,'products',removable.id))).data();
    await stockContext.commitProductChanges([{id:removable.id,before:fresh,after:null}]);
    await stockContext.commitProductChanges([{id:removable.id,before:fresh,after:null}]);
    assert.equal((await getDoc(doc(secondAdmin,'products',removable.id))).exists(),false);
    await assert.rejects(stockContext.testCommitStock({...inbound,items:[{...inbound.items[0],qty:4}]}),/outros dados/);
    assert.equal((await getDoc(productRef)).data().stock,7);
    await assert.rejects(stockContext.testCommitStock({id:'stale-count',kind:'count',reason:'Teste isolado',items:[{pid:'camiseta',qty:10,expected:6}]}),/estoque mudou/i);
    assert.equal((await getDoc(doc(secondAdmin,'config','stale-count'))).exists(),false);
    for(let i=0;i<80&&!(seen.some(([k,v])=>k==='stock'&&v===7)&&seen.some(([k,v])=>k==='sale'&&v===0)&&seen.some(([k,v])=>k==='order'&&v==='confirmed'));i++)await new Promise(r=>setTimeout(r,100));
    assert.ok(seen.some(([k,v])=>k==='stock'&&v===7));
    assert.ok(seen.some(([k,v])=>k==='sale'&&v===0));
    assert.ok(seen.some(([k,v])=>k==='order'&&v==='confirmed'));
    const fields={pc:{value:'38'},pp:{value:'80'},pn:{value:'Camiseta A'},ps:{value:'10'}};
    Object.assign(stockContext,{$:id=>fields[id]||{innerHTML:''},pBrand:()=>null,pCur:'',tmpImg:'',
     productFormBusy:false,productFormSnapshot:stale,productFormOperation:'test-product-form',closeM(){}});
    await stockContext.saveProductCloud('camiseta');
    assert.match(warnings.at(-1),/mudou em outra sessão/);
    assert.equal((await getDoc(productRef)).data().stock,7);
    stockContext.productFormSnapshot=null;
    fields.pn.value='Novo produto';
    fields.ps.value='3';
    await stockContext.saveProductCloud('');
    await stockContext.saveProductCloud('');
    assert.equal((await getDoc(doc(secondAdmin,'products','test-product-form'))).data().stock,3);
    assert.equal((await getDoc(doc(secondAdmin,'products','test-product-form'))).data().stockRevision,1);
    assert.deepEqual((await getDoc(ref('sales','historical'))).data(),original.data());
   }finally{stops.forEach(fn=>fn())}
  }finally{stockPage.window.close()}
  const buyerContext=uid=>environment.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous',identities:{}}}).firestore();
  const buyer=buyerContext('BuyerTest'), otherBuyer=buyerContext('OtherBuyer');
  const submitBuyer=(client,uid,key,patch={})=>{
   const id=uid+'_'+key,batch=writeBatch(client);
   batch.set(doc(client,'nexusOrders',id),{
    key,code:key.replaceAll('-','').toUpperCase(),customer:'Cliente teste',customerPhone:'5511999991234',mode:'pickup',address:null,notes:'',
    itemsJSON:JSON.stringify(order.items),subtotalCents:16000,shippingCents:0,fingerprint:'a'.repeat(64),
    status:'pending',createdAt:serverTimestamp(),...patch
   });
   batch.set(doc(client,'nexusOrderQuota',uid),{id,at:serverTimestamp()});
   return batch.commit();
  };
  const directKey='0e9155ef-30d9-4d65-bb45-26a2b0897574',directId='BuyerTest_'+directKey;
  assert.equal((await getDoc(doc(buyer,'nexusOrders',directId))).exists(),false);
  const {persistOrder}=await import('../catalogo/assets/order-firestore.js');
  const buyerSdk={...require('firebase/firestore'),db:buyer,uid:'BuyerTest'};
  const directOrder={key:directKey,code:directKey.replaceAll('-','').toUpperCase(),customer:'Cliente teste',customerPhone:'5511999991234',
   mode:'pickup',address:null,notes:'',items:order.items,subtotalCents:16000,shippingCents:0,fingerprint:'a'.repeat(64)};
  const concurrentBuyer=await Promise.all([persistOrder(buyerSdk,directOrder),persistOrder(buyerSdk,directOrder)]);
  assert.ok(concurrentBuyer.every(receipt=>receipt.code===directOrder.code&&receipt.fingerprint===directOrder.fingerprint));
  assert.equal((await persistOrder(buyerSdk,directOrder)).code,directOrder.code);
  await assertFails(getDoc(doc(otherBuyer,'nexusOrders',directId)));
  await assertFails(getDocs(collection(buyer,'nexusOrders')));
  await assertFails(getDoc(doc(buyer,'products','camiseta')));
  await assertFails(setDoc(doc(buyer,'nexusOrders',directId),{status:'confirmed'},{merge:true}));
  await assertFails(submitBuyer(buyer,'BuyerTest','0e9155ef-30d9-4d65-bb45-26a2b0897575'));
  const otherKey='0e9155ef-30d9-4d65-bb45-26a2b0897576';
  await assertFails(submitBuyer(otherBuyer,'OtherBuyer',otherKey,{status:'confirmed'}));
  await assertFails(submitBuyer(otherBuyer,'OtherBuyer',otherKey,{customerPhone:''}));
  await assertFails(submitBuyer(otherBuyer,'OtherBuyer',otherKey,{itemsJSON:'x'.repeat(24001)}));
  await assertFails(submitBuyer(otherBuyer,'OtherBuyer',otherKey,{shippingCents:1}));
  await submitBuyer(otherBuyer,'OtherBuyer',otherKey,{itemsJSON:JSON.stringify(Array.from({length:30},(_,i)=>({...order.items[0],id:'item-'+i})))});
  await decide('OtherBuyer_'+otherKey,false);
  const buyerReceipt=(await getDoc(doc(buyer,'nexusOrders',directId))).data();
  assert.equal(buyerReceipt.status,'pending');
  assert.equal(typeof buyerReceipt.createdAt.toMillis(),'number');
  await Promise.all([decide(directId,true,['camiseta'],0,0),decide(directId,true,['camiseta'],0,0)]);
  assert.equal((await getDoc(doc(secondAdmin,'nexusOrders',directId))).data().status,'confirmed');
  assert.equal((await getDoc(doc(secondAdmin,'sales','pedido-'+directId))).data().price,160);
  assert.equal((await getDoc(doc(secondAdmin,'sales','pedido-'+directId))).data().phone,'5511999991234');
  assert.equal((await getDoc(doc(secondAdmin,'products','camiseta'))).data().stock,5);
  const rejectedBuyer=buyerContext('RejectedBuyer');
  const rejectedKey='0e9155ef-30d9-4d65-bb45-26a2b0897577';
  const rejectedId='RejectedBuyer_'+rejectedKey;
  await submitBuyer(rejectedBuyer,'RejectedBuyer',rejectedKey,{itemsJSON:JSON.stringify([{...order.items[0],priceCents:1}])});
  await assert.rejects(decide(rejectedId,true,['camiseta'],0,0),/preço do estoque/);
  assert.equal((await getDoc(ref('sales','pedido-'+rejectedId))).exists(),false);
  await environment.withSecurityRulesDisabled(async context=>{
   await setDoc(doc(context.firestore(),'nexusOrderControl','intake'),{enabled:false});
  });
  await assertFails(setDoc(doc(store,'nexusOrderControl','intake'),{enabled:true}));
  const stoppedBuyer=buyerContext('StoppedBuyer');
  await assertFails(submitBuyer(stoppedBuyer,'StoppedBuyer',rejectedKey));
  assert.equal((await getDoc(doc(buyer,'nexusOrders',directId))).data().status,'confirmed');
  await decide(rejectedId,false);
  assert.equal((await getDoc(doc(secondAdmin,'nexusOrders',rejectedId))).data().status,'cancelled');
  assert.equal((await getDoc(doc(secondAdmin,'products','camiseta'))).data().stock,5);
  console.log('PASS cliente Firestore: criação anônima restrita, 30 itens, corrida, isolamento e venda/estoque.');
  context.unsubs.forEach(fn=>fn());
  console.log('PASS emulador: regras, contador, confirmação e cancelamento concorrentes, retry, estoque, edição concorrente, recebimento, histórico, entrada concorrente e sincronização de dois administradores.');
 }finally{page.window.close();await environment.cleanup()}
}
run().catch(error=>{console.error(error);process.exitCode=1});
