/* Pedidos da vitrine pública e operações comerciais no Firestore existente. */
(() => {
'use strict';
let orderRows=[],orderReadError='',orderReady=false,detachOrders=null;
let heardOrders=new Set(),sound=null;
const busy=new Set();
const ordersRef=()=>db.collection('nexusOrders');
const authenticated=()=>Boolean(db&&cloudOn&&au?.currentUser);
const cents=n=>Math.round(Number(n)*100);
const currency=n=>money(n/100);
const validMoney=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
const pendingCount=()=>orderRows.filter(x=>x.status==='pending').length;
const actor=()=>au.currentUser.uid;
const event=(label,at)=>({id:crypto.randomUUID(),label,at,actor:actor()});
const commercialId=/^[A-Za-z0-9_-]{1,128}$/;
const dateValid=d=>/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const fail=message=>{throw Error(message)};
const saleRef=id=>db.collection('sales').doc(id);
const pendingLabel=()=>orderReady?' ('+pendingCount()+')':'';
function paintCount(){
 document.querySelectorAll('[data-nexus-count]').forEach(el=>el.textContent=pendingLabel());
 if(tab==='orders'&&!$('modal').innerHTML){
  const panel=$('nexusOrdersPanel');
  if(panel){
   const open=[...panel.querySelectorAll('details[open]')].map(el=>el.dataset.orderRow);
   const focus=document.activeElement;
   const focusedRow=focus.closest('[data-order-row]')?.dataset.orderRow;
   const focusedAction=focus.dataset.nexusAction;
   panel.outerHTML=ordersView();
   const rows=[...$('nexusOrdersPanel').querySelectorAll('details')];
   rows.forEach(el=>el.open=open.includes(el.dataset.orderRow));
   const row=rows.find(el=>el.dataset.orderRow===focusedRow);
   if(focusedAction==='sound')$('nexusOrdersPanel').querySelector('[data-nexus-action="sound"]')?.focus();
   else if(row)(row.querySelector('[data-nexus-action="'+(focusedAction||'')+'"]')||row.querySelector('summary'))?.focus();
  }
 }
}
function chime(){
 if(sound?.state!=='running')return;
 const oscillator=sound.createOscillator(),volume=sound.createGain(),now=sound.currentTime;
 oscillator.frequency.value=590;volume.gain.setValueAtTime(.12,now);volume.gain.exponentialRampToValueAtTime(.001,now+.2);
 oscillator.connect(volume).connect(sound.destination);oscillator.start(now);oscillator.stop(now+.21);
}
async function toggleSound(button){
 if(sound?.state==='running'){await sound.suspend();button.textContent='Ativar som';return}
 try{
  sound??=new AudioContext();await sound.resume();
  button.textContent=sound.state==='running'?'Desativar som':'Som indisponível';
 }catch{button.textContent='Som indisponível'}
}
const previousListen=listen;
listen=function(){
 previousListen();
 detachOrders?.();heardOrders=new Set();orderRows=[];orderReady=false;orderReadError='';
 detachOrders=ordersRef().onSnapshot({includeMetadataChanges:true},sn=>{
  if(sn.metadata.fromCache)return;
  const previous=heardOrders.size;
  orderRows=sn.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const unread=orderRows.some(o=>o.status==='pending'&&!heardOrders.has(o.id));
  if((orderReady||previous)&&unread)chime();
  orderRows.forEach(o=>heardOrders.add(o.id));
  orderReady=true;orderReadError='';paintCount();
 },()=>{
  orderRows=[];orderReady=false;orderReadError='Não foi possível sincronizar os pedidos.';paintCount();
 });
 unsubs.push(()=>{
  detachOrders?.();detachOrders=null;orderRows=[];orderReady=false;orderReadError='';heardOrders.clear();void sound?.suspend();
  document.querySelectorAll('[data-nexus-count]').forEach(el=>el.textContent='');
  if(tab==='orders')render();
 });
};
function ordersView(){
 const status={pending:'Pendente',confirmed:'Confirmado',cancelled:'Cancelado'};
 return '<section id="nexusOrdersPanel"><h1>Pedidos</h1><p role="status">'+esc(orderReadError||
  (!authenticated()?'Entre para consultar pedidos.':orderReady?pendingCount()+' pedido(s) pendente(s)':'Sincronizando pedidos…'))+'</p>'+
  (authenticated()?'<button type="button" class="g" data-nexus-action="sound">'+(sound?.state==='running'?'Desativar som':'Ativar som')+'</button>':'')+
  orderRows.map(o=>'<details class="card item" data-order-row="'+esc(o.id)+'"><summary><b>'+esc(o.code)+'</b> · '+esc(o.customer)+' · '+esc(status[o.status]||o.status)+'</summary>'+
   o.items.map(i=>'<div class="inst">'+esc(i.quantity+' × '+[i.brand,i.model,i.size].filter(Boolean).join(' · '))+'<b>'+currency(i.quantity*i.priceCents)+'</b></div>').join('')+
   '<p>Subtotal '+currency(o.subtotalCents)+' · '+(o.mode==='pickup'?'Retirada':o.shippingCents===null?'Entrega a conferir':'Entrega '+currency(o.shippingCents))+'</p>'+
   (o.address?'<p>'+esc([o.address.street,o.address.number,o.address.cep,o.address.reference].filter(Boolean).join(' · '))+'</p>':'')+
   (o.notes?'<p>'+esc(o.notes)+'</p>':'')+
   (o.status==='pending'?'<div class="row">'+button('cancel',o.id,'Cancelar')+button('confirm',o.id,'Confirmar')+'</div>':'')+'</details>').join('')+'</section>';
}
function button(action,id,label){
 return '<button type="button" class="g" data-nexus-action="'+action+'" data-nexus-id="'+esc(id)+'">'+label+'</button>';
}
function form(title,fields,submit){
 modal('<h1>'+title+'</h1><form id="nexusForm">'+fields+'<p role="alert" id="nexusError"></p><div class="row"><button>Salvar</button><button class="g" type="button" onclick="closeM()">Voltar</button></div></form>');
 const form=$('nexusForm');
 form.onsubmit=async e=>{
  e.preventDefault();
  if(busy.has(form))return;
  busy.add(form);form.querySelector('button').disabled=true;
  try{if(!authenticated())fail('Entre novamente.');await submit(new FormData(form));if(form.isConnected){closeM();render()}}
  catch(error){if(form.isConnected)$('nexusError').textContent=error.message}
  finally{busy.delete(form);form.querySelector('button').disabled=false}
 };
}
function field(name,label,value='',type='text',attributes=''){
 return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+attributes+'></label>';
}
function productField(name,selected='',optional=false){
 return '<label>Produto no estoque <select name="'+name+'" '+(optional?'':'required')+'><option value="">'+(optional?'Item avulso':'Selecione')+'</option>'+
  S.products.filter(p=>commercialId.test(p.id)).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+
   esc([p.name,p.brand,p.model,p.flavor].filter(Boolean).join(' · '))+' ('+esc(p.stock)+' un.)</option>').join('')+'</select></label>';
}
function confirmForm(order){
 if(!order)return;
 const fields=order.items.map((i,n)=>{
  const linked=S.products.filter(p=>p.catalogId===i.id||p.id===i.id);
  return '<fieldset><legend>'+esc(i.quantity+' × '+[i.brand,i.model,i.size].filter(Boolean).join(' · '))+' · '+currency(i.priceCents)+'/un.</legend>'+
   productField('p'+n,linked.length===1?linked[0].id:'')+'</fieldset>';
 }).join('');
 form('Confirmar pedido',fields+(order.shippingCents===null?field('fee','Frete conferido (R$)','','number','required min="0" step=".01"'):'')+
  '<p>Confira os produtos vinculados. A confirmação registra a venda e baixa o estoque.</p>',
  async data=>{
   const response=await fetch('https://km-camisetas-catalogo.inventivetoucan16.chatgpt.site/api/catalog',{signal:AbortSignal.timeout(10000)});
   if(!response.ok)fail('Não foi possível conferir o catálogo atualizado.');
   const catalog=await response.json();
   if(!order.items.every(i=>catalog.products.some(p=>p.id===i.id&&p.available!==false&&cents(p.price)===i.priceCents&&
    [p.brand,p.model,p.size||''].join('|')===[i.brand,i.model,i.size].join('|'))))fail('Preço ou disponibilidade mudou. Solicite uma nova revisão do comprador.');
   return decide(order.id,true,order.items.map((_,n)=>data.get('p'+n)),order.shippingCents??cents(data.get('fee')),order.shippingCents);
  });
}
async function decide(id,accept,productIds=[],fee=0,reviewedShipping=null){
 if(!commercialId.test(id))fail('Pedido inválido.');
 const orderRef=ordersRef().doc(id),saleId='pedido-'+id,at=new Date().toISOString(),decisionActor=actor();
 const expected=accept?'confirmed':'cancelled';
 try{await db.runTransaction(async tx=>{
  const snap=await tx.get(orderRef);
  if(!snap.exists)fail('Pedido não encontrado.');
  const order=snap.data();
  if(order.status===expected)return;
  if(order.status!=='pending')fail('Este pedido já foi encerrado.');
  if(!accept){
   tx.update(orderRef,{status:expected,decidedAt:at,decidedBy:decisionActor});
   return;
  }
  if(!validMoney(fee)||order.shippingCents!==reviewedShipping||(order.shippingCents!==null&&fee!==order.shippingCents))fail('Confira o frete atualizado.');
  if(productIds.length!==order.items.length||productIds.some(id=>!commercialId.test(id)))fail('Vincule todos os itens ao estoque.');
  const ref=saleRef(saleId);
  if((await tx.get(ref)).exists)fail('Já existe uma venda vinculada.');
  const products=await readProducts(tx,productIds);
  const items=order.items.map((i,n)=>{
   const p=products.get(productIds[n]).data;
   if(p.catalogId&&p.catalogId!==i.id)fail('O produto vinculado pertence a outro item do catálogo.');
   if(!validMoney(cents(p.cost)))fail('Confira o custo cadastrado no estoque.');
   return {pid:productIds[n],name:[i.brand,i.model,i.size].filter(Boolean).join(' · '),quantity:i.quantity,priceCents:i.priceCents,costCents:cents(p.cost)};
  });
  const sale={id:saleId,source:'catalog',orderId:id,orderCode:order.code,items,client:order.customer,phone:'',
   note:order.notes,date:today(),createdAt:at,updatedAt:at,revision:1,inst:[],fees:0,saleExpenses:0,discountCents:0,shippingCents:fee,conditions:'',
   events:[event('Pedido confirmado',at)]};
  calculate(sale);
  sale.events[0].stock=updateStock(tx,products,[],items);
  tx.set(ref,sale);
  tx.update(orderRef,{status:expected,saleId,confirmedShippingCents:fee,decidedAt:at,decidedBy:decisionActor});
 })}catch(error){
  if(error.code!=='permission-denied')throw error;
  const latest=await db.runTransaction(tx=>tx.get(orderRef));
  if(!latest.exists||latest.data().status!==expected)throw error;
 }
}
async function readProducts(tx,ids){
 const products=new Map();
 for(const id of [...new Set(ids.filter(Boolean))].sort()){
  if(!commercialId.test(id))fail('Produto inválido.');
  const ref=db.collection('products').doc(id),snapshot=await tx.get(ref);
  if(!snapshot.exists)fail('Um produto não está mais no estoque.');
  products.set(id,{ref,data:snapshot.data()});
 }
 return products;
}
function updateStock(tx,products,before,after){
 const movements=[];
 const delta=new Map();
 for(const [sign,items] of [[1,before],[-1,after]]){
  for(const i of items)if(i.pid)delta.set(i.pid,(delta.get(i.pid)||0)+sign*i.quantity);
 }
 for(const [id,change] of delta){
  if(!change)continue;
  const {ref,data}=products.get(id),stock=Number(data.stock)+change;
  if(!Number.isSafeInteger(stock)||stock<0)fail('Estoque insuficiente para '+data.name+'.');
  tx.update(ref,{stock});
  movements.push({pid:id,before:Number(data.stock),after:stock,delta:change});
 }
 return movements;
}
function calculate(sale){
 if(!sale.items.length||sale.items.length>30||sale.items.some(i=>!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>99||
  !validMoney(i.priceCents)||!validMoney(i.costCents)||!i.name))fail('Confira os itens, quantidades, preços e custos.');
 const subtotal=sale.items.reduce((n,i)=>n+i.quantity*i.priceCents,0);
 const total=subtotal-sale.discountCents+sale.shippingCents;
 if(!validMoney(sale.discountCents)||sale.discountCents>subtotal||!validMoney(sale.shippingCents)||!validMoney(total))fail('Confira o valor, o desconto e o frete.');
 sale.name=sale.items.map(i=>i.quantity+' × '+i.name).join(' · ');sale.pid='';
 sale.price=total/100;sale.cost=sale.items.reduce((n,i)=>n+i.costCents*i.quantity,0)/100;
 if(paymentTotal(sale.inst)>total)fail('O total é menor que as cobranças registradas. Ajuste primeiro as cobranças em aberto.');
}
const paymentTotal=inst=>inst.reduce((n,i)=>n+cents(i.v),0);
function lineFields(item={},index=0){
 return '<fieldset data-nexus-line><legend>Item</legend>'+productField('pid'+index,item.pid,true)+field('item'+index,'Descrição do item',item.name,'text','maxlength="160"')+
  field('qty'+index,'Quantidade',item.quantity??1,'number','required min="1" max="99" step="1"')+
  field('price'+index,'Preço unitário',item.priceCents===undefined?'':item.priceCents/100,'number','required min="0" step=".01"')+
  field('cost'+index,'Custo unitário',item.costCents===undefined?'':item.costCents/100,'number','required min="0" step=".01"')+
  '<button type="button" class="g" data-nexus-action="remove-line">Remover item</button></fieldset>';
}
function editForm(sale){
 const base=sale.revision;
 let next=sale.items.length;
 form('Editar venda',field('name','Cliente',sale.client,'text',(sale.source==='catalog'?'required ':'')+'maxlength="120"')+
  field('phone','WhatsApp',sale.phone,'tel','maxlength="24"')+field('date','Data da venda',sale.date,'date','required')+
  '<div id="nexusLines">'+sale.items.map(lineFields).join('')+'</div>'+button('add-line','','Adicionar item')+
  field('discount','Desconto (R$)',sale.discountCents/100,'number','required min="0" step=".01"')+
  field('shipping','Frete (R$)',sale.shippingCents/100,'number','required min="0" step=".01"')+
  field('conditions','Condições comerciais',sale.conditions,'text','maxlength="300"')+
  field('method','Forma de pagamento combinada',sale.paymentMethod,'text','maxlength="60"')+
  field('owner','Responsável',sale.owner,'text','maxlength="100"')+
  field('fees','Taxas (R$)',sale.fees||0,'number','required min="0" step=".01"')+
  field('expenses','Despesas (R$)',sale.saleExpenses||0,'number','required min="0" step=".01"')+
  field('note','Observações',sale.note,'text','maxlength="500"'),
  data=>writeSale(sale.id,base,async(live,tx)=>{
   const keys=[...data.keys()].filter(k=>/^pid\d+$/.test(k)).map(k=>k.slice(3));
   const pids=keys.map(n=>data.get('pid'+n));
   const products=await readProducts(tx,[...pids,...live.items.map(i=>i.pid)]);
   const items=keys.map((n,k)=>({pid:pids[k],name:data.get('item'+n).trim()||products.get(pids[k])?.data.name,quantity:Number(data.get('qty'+n)),
    priceCents:cents(data.get('price'+n)),costCents:cents(data.get('cost'+n))}));
   const changed={...live,items,client:data.get('name').trim(),phone:data.get('phone').trim(),
    date:data.get('date'),discountCents:cents(data.get('discount')),shippingCents:cents(data.get('shipping')),
    conditions:data.get('conditions').trim(),note:data.get('note').trim(),
    paymentMethod:data.get('method').trim(),owner:data.get('owner').trim(),fees:Number(data.get('fees')),saleExpenses:Number(data.get('expenses'))};
   if((live.source==='catalog'&&!changed.client)||!dateValid(changed.date)||!validMoney(cents(changed.fees))||!validMoney(cents(changed.saleExpenses)))fail('Confira o cliente, a data, as taxas e as despesas.');
   calculate(changed);
   changed.stockAdjustment=updateStock(tx,products,live.items,items);
   return changed;
  },'Venda revisada'));
 $('nexusForm').addEventListener('click',e=>{
  if(e.target.dataset.nexusAction==='add-line'&&$('nexusLines').children.length<30)$('nexusLines').insertAdjacentHTML('beforeend',lineFields({},next++));
  if(e.target.dataset.nexusAction==='remove-line')e.target.closest('[data-nexus-line]').remove();
 });
}
async function writeSale(id,version,change,label){
 const ref=saleRef(id),at=new Date().toISOString(),audit=event(label,at);
 try{await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  const live=snap.data();
  if(!snap.exists||!managed(live)||live.revision!==version)fail('A venda foi atualizada. Reabra e confira.');
  const updated=await change(live,tx);
  const {stockAdjustment,...record}=updated;
  const entry=stockAdjustment?.length?{...audit,stock:stockAdjustment}:audit;
  tx.set(ref,{...record,revision:version+1,updatedAt:at,events:[...(live.events||[]),entry]});
 })}catch(error){
  if(error.code!=='permission-denied')throw error;
  const latest=await db.runTransaction(tx=>tx.get(ref));
  if(latest.exists&&latest.data().revision!==version)fail('A venda foi atualizada. Reabra e confira.');
  throw error;
 }
}
const managed=s=>Boolean(s?.revision&&Array.isArray(s.items));
function chargeForm(sale,index){
 const existing=sale.inst[index];
 if(existing?.paid)return;
 form(existing?'Editar cobrança':'Cadastrar cobrança',field('amount','Valor (R$)',existing?.v,'number','required min=".01" step=".01"')+
  field('due','Vencimento',existing?.d,'date','required')+
  field('note','Descrição',existing?.note,'text','maxlength="300"')+
  field('method','Forma de pagamento',existing?.paymentMethod,'text','maxlength="60"')+
  field('paid','Data de pagamento efetivado','','date'),
  data=>writeSale(sale.id,sale.revision,live=>{
   const amount=cents(data.get('amount')),due=data.get('due'),paidDate=data.get('paid');
   if(!validMoney(amount)||amount<1||!dateValid(due)||(paidDate&&(!dateValid(paidDate)||paidDate>today())))fail('Confira o valor e as datas.');
   const inst=live.inst.slice();
   const charge={id:existing?.id||crypto.randomUUID(),v:amount/100,d:due,paid:!!paidDate,pd:paidDate||null,note:data.get('note').trim(),paymentMethod:data.get('method').trim()};
   if(existing)inst[index]=charge;else inst.push(charge);
   if(paymentTotal(inst)>cents(live.price))fail('O valor supera o saldo disponível para cobranças.');
   return {...live,inst};
  },existing?'Cobrança revisada':'Cobrança registrada'));
}
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-nexus-action]');if(!el)return;
 const id=el.dataset.nexusId,action=el.dataset.nexusAction;
 const o=orderRows.find(s=>s.id===id),s=S.sales.find(s=>s.id===id);
 if(action==='sound')return toggleSound(el);
 if(action==='confirm')return confirmForm(o);
 if(action==='cancel'&&o&&authenticated()&&confirm('Cancelar este pedido e manter o histórico?')){
  el.disabled=true;
  try{await decide(id,false)}catch(error){alert(error.message)}finally{el.disabled=false}
 }
 if(action==='edit'&&managed(s))editForm(s);
 if(action==='charge'&&managed(s))chargeForm(s,Number(el.dataset.nexusIndex));
});
const previousSaleForm=saleForm;
const previousSaveSale=saveSale;
saleForm=function(id){
 const sale=S.sales.find(s=>s.id===id);
 if(managed(sale))return editForm(sale);
 previousSaleForm(id);
 if(id)return;
 $('redo').hidden=true;
 $('pr').hidden=true;
 $('so').insertAdjacentHTML('afterend',field('manualDate','Data da venda',today(),'date','id="nexusManualDate"')+
  field('manualShipping','Frete (R$)',0,'number','id="nexusManualShipping" min="0" step=".01"')+
  field('manualConditions','Condições comerciais','','text','id="nexusManualConditions" maxlength="300"')+
  '<p class="sub">Cadastre cobranças manualmente na aba Cobranças após salvar a venda.</p><p id="nexusManualError" role="alert"></p>');
 const saveButton=$('modal').querySelector('[onclick="saveSale()"]'),key='manual-'+crypto.randomUUID();
 saveButton.dataset.nexusManual=key;
};
saveSale=async function(){
 const error=$('nexusManualError');
 if(!error)return previousSaveSale();
 const saveButton=$('modal').querySelector('[data-nexus-manual]');
 if(busy.has(saveButton))return;
 busy.add(saveButton);saveButton.disabled=true;
 try{
  if(!authenticated())fail('Entre na sua conta para registrar a venda.');
  const selected=$('sp').value,discount=$('discEnable').checked?cents($('discBase').value)-cents($('sv2').value):0;
  const pid=selected.startsWith('c:')?'':selected;
  const at=new Date().toISOString(),id=saveButton.dataset.nexusManual,date=$('nexusManualDate').value;
  const sale={id,source:'manual',items:[{pid,name:$('sn').value.trim(),quantity:1,priceCents:cents($('sv2').value)+discount,costCents:cents($('sc').value)}],
   client:$('sl').value.trim(),phone:$('sf').value.trim(),date,note:$('so').value.trim(),createdAt:at,updatedAt:at,
   revision:1,inst:[],discountCents:discount,shippingCents:cents($('nexusManualShipping').value),conditions:$('nexusManualConditions').value.trim(),
   img:tmpImg,owner:$('b3Owner')?.value.trim()||'',paymentMethod:$('b3Method')?.value||'',
   fees:Number($('b3Fees')?.value||0),saleExpenses:Number($('b3SaleExpenses')?.value||0),events:[event('Venda manual registrada',at)]};
  if(!dateValid(date)||!validMoney(cents(sale.fees))||!validMoney(cents(sale.saleExpenses)))fail('Confira a data, as taxas e as despesas.');
  calculate(sale);
  const ref=saleRef(id);
  await db.runTransaction(async tx=>{
   if((await tx.get(ref)).exists)return;
   const products=await readProducts(tx,[pid]);
   sale.events[0].stock=updateStock(tx,products,[],sale.items);tx.set(ref,sale);
  });
  try{localStorage.removeItem(KEY+'_sale_draft_'+actor())}catch{}
  if(saveButton.isConnected){closeM();go('sales')}
 }catch(failure){if(error.isConnected)error.textContent=failure.message}
 finally{busy.delete(saveButton);saveButton.disabled=false}
};
const previousPay=pay;
pay=function(id,index){
 const s=S.sales.find(s=>s.id===id);
 if(!managed(s))return previousPay(id,index);
 if(!s.inst[index]?.paid)chargeForm(s,index);
};
const previousDelete=delSale;
delSale=function(id){
 if(managed(S.sales.find(s=>s.id===id)))return alert('A venda deve ser revisada com estoque e recebimentos preservados.');
 return previousDelete(id);
};
window.kmNexus={ordersView,pendingLabel,managed,button};
if(authenticated())listen();
})();
