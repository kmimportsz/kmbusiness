/* Atomic stock operations and a ledger for operations performed from this module. */
(() => {
'use strict';
let busy=false;
const TYPE='b3-stock-operation';
const button=(a,id,t)=>`<button type="button" class="g" data-stock="${a}" data-id="${esc(id||'')}">${t}</button>`;
const ops=()=>S.config.filter(x=>x.type===TYPE);
const actor=()=>au?.currentUser?.email||'Registro local';
const row=n=>`<div class="stock-row" data-row><div><label for="stockP${n}">Produto</label><select id="stockP${n}" data-product required><option value="">Selecione</option>${S.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · disponível ${Number(p.stock)||0}</option>`).join('')}</select></div><div><label for="stockQ${n}">Quantidade</label><input id="stockQ${n}" data-qty type="number" min="1" max="100000" step="1" required></div><div><label for="stockC${n}">Custo unitário (R$)</label><input id="stockC${n}" data-cost type="number" min="0" step="0.01" required></div></div>`;
const cache=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
async function commitStock(op){
 const calculate=(live,entry)=>{const before=Number(live.stock)||0;if(op.kind==='count'&&(before!==entry.expected||(entry.expectedRevision!==undefined&&(live.stockRevision??0)!==entry.expectedRevision)))throw Error('O estoque mudou durante a conferência. Reabra a contagem antes de ajustar.');const stock=op.kind==='count'?entry.qty:before+entry.qty;if(!Number.isSafeInteger(stock)||stock<0)throw Error('A quantidade final de estoque é inválida.');const value={...live,stock};if(stock!==live.stock)value.stockRevision=(live.stockRevision??0)+1;if(op.kind==='inbound')value.cost=entry.cost;return{value,item:{pid:live.id,name:live.name,before,after:stock,delta:stock-before,cost:Number(value.cost)||0}};};
 const payload=JSON.stringify({kind:op.kind,reason:op.reason,items:op.items});
 let products=[],record;
 if(window.firebase){
  if(!db||!cloudOn||!ready.products||!ready.config)throw Error('Entre na sua conta e aguarde a sincronização do estoque.');
  const ref=db.collection('config').doc(op.id);
  await runStockTransaction(async tx=>{
   const previous=await tx.get(ref),snapshots=[];
   for(const item of op.items){const pRef=db.collection('products').doc(item.pid),snap=await tx.get(pRef);if(!snap.exists)throw Error('Um produto não está mais disponível. Reabra a entrada.');snapshots.push({ref:pRef,live:{...snap.data(),id:item.pid},entry:item});}
   if(previous.exists){record={...previous.data(),id:op.id};if(record.payload&&record.payload!==payload)throw Error('Esta operação já foi registrada com outros dados. Abra um novo formulário.');products=snapshots.map(x=>x.live);return;}
   const changed=snapshots.map(x=>({...x,...calculate(x.live,x.entry)}));
   record={id:op.id,type:TYPE,kind:op.kind,reason:op.reason,actor:actor(),at:new Date().toISOString(),payload,items:changed.map(x=>x.item)};
   changed.forEach(x=>tx.set(x.ref,x.value));tx.set(ref,record);products=changed.map(x=>x.value);
  });
 }else{
  const existing=ops().find(x=>x.id===op.id);if(existing)return;
  const changed=op.items.map(item=>{const p=S.products.find(p=>p.id===item.pid);if(!p)throw Error('Produto não encontrado.');return calculate(p,item);});products=changed.map(x=>x.value);record={id:op.id,type:TYPE,kind:op.kind,reason:op.reason,actor:actor(),at:new Date().toISOString(),payload,items:changed.map(x=>x.item)};
 }
 for(const product of products){
  const i=S.products.findIndex(p=>p.id===product.id);
  const displayed=i>=0?S.products[i]:null;
  if((displayed?.stockRevision??0)>(product.stockRevision??0))continue;
  if(i>=0)S.products[i]=product;
  last.products[product.id]=JSON.stringify(product);
 }
 const index=S.config.findIndex(x=>x.id===record.id);if(index<0)S.config.push(record);else S.config[index]=record;last.config[record.id]=JSON.stringify(record);cache();
}
function inbound(){if(!S.products.length)return alert('Cadastre os produtos antes de registrar uma entrada.');const operation='b3_stock_'+uid();let count=1;
 modal(`<h1>Entrada de estoque em lote</h1><p class="sub">Adicione os produtos recebidos. O custo informado passa a ser o custo unitário atual do cadastro; não é média ponderada. Esta entrada não lança uma despesa financeira.</p><form id="stockForm"><div id="stockRows">${row(0)}</div><div class="b3-actions">${button('add','','＋ Outro produto')}</div><label for="stockReason">Fornecedor / referência da reposição</label><input id="stockReason" maxlength="300" required><p id="stockFeedback" role="status"></p><button type="submit">Conferir entrada</button> ${button('close','','Cancelar')}</form>`);
 $('stockForm').addEventListener('change',e=>{if(e.target.matches('[data-product]')){const p=S.products.find(p=>p.id===e.target.value);e.target.closest('[data-row]').querySelector('[data-cost]').value=p?.cost??'';}});
 $('modal').querySelector('[data-stock="add"]').onclick=()=>{$('stockRows').insertAdjacentHTML('beforeend',row(count++));};
 $('stockForm').addEventListener('submit',async e=>{e.preventDefault();if(busy||!e.currentTarget.reportValidity())return;const items=[...$('stockRows').querySelectorAll('[data-row]')].map(r=>({pid:r.querySelector('[data-product]').value,qty:Number(r.querySelector('[data-qty]').value),cost:Number(r.querySelector('[data-cost]').value)}));if(new Set(items.map(x=>x.pid)).size!==items.length){$('stockFeedback').textContent='Use uma linha por produto. Some as quantidades repetidas.';return;}if(items.some(x=>!Number.isSafeInteger(x.qty)||x.qty<1||x.qty>100000||!Number.isFinite(x.cost)||x.cost<0)){$('stockFeedback').textContent='Confira as quantidades inteiras e os custos.';return;}if(!$('stockReason').value.trim()){$('stockFeedback').textContent='Informe a referência da reposição.';return;}const preview=items.map(x=>`${S.products.find(p=>p.id===x.pid)?.name}: +${x.qty} un., custo unitário ${money(x.cost)}`).join('\n');if(!confirm('Confirmar esta entrada?\n\n'+preview))return;await save(e.currentTarget,{id:operation,kind:'inbound',reason:$('stockReason').value.trim(),items});});
}
function countForm(){modal(`<h1>Conferência física de estoque</h1><p class="sub">Conte as unidades disponíveis. Se houver diferença, informe uma justificativa. O sistema recusa o ajuste se o estoque mudar durante a conferência.</p><form id="stockForm"><label for="stockProduct">Produto</label><select id="stockProduct" required><option value="">Selecione</option>${S.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><p id="stockExpected" class="sub"></p><label for="stockFound">Quantidade encontrada</label><input id="stockFound" type="number" min="0" step="1" max="100000" required><label for="stockReason">Justificativa do ajuste</label><textarea id="stockReason" maxlength="1000" required></textarea><p id="stockFeedback" role="status"></p><button type="submit">Conferir e ajustar</button> ${button('close','','Cancelar')}</form>`);let expected=null,expectedRevision=0;const operation='b3_stock_'+uid();$('stockProduct').onchange=()=>{const p=S.products.find(p=>p.id===$('stockProduct').value);expected=p?Number(p.stock)||0:null;expectedRevision=p?.stockRevision??0;$('stockExpected').textContent=p?'Disponível registrado ao abrir: '+expected+' unidade(s).':'';};$('stockForm').onsubmit=async e=>{e.preventDefault();if(busy||!e.currentTarget.reportValidity())return;const qty=Number($('stockFound').value),reason=$('stockReason').value.trim();if(expected===null||!Number.isSafeInteger(qty)||qty<0||qty>100000||!reason){$('stockFeedback').textContent='Confira produto, quantidade inteira e justificativa.';return;}if(qty===expected){$('stockFeedback').textContent='A contagem está correta. Nenhum ajuste é necessário.';return;}if(!confirm('Ajustar de '+expected+' para '+qty+' unidade(s)?\nMotivo: '+reason))return;await save(e.currentTarget,{id:operation,kind:'count',reason,items:[{pid:$('stockProduct').value,qty,expected,expectedRevision}]});};}
async function save(form,op){busy=true;const b=form.querySelector('[type="submit"]');b.disabled=true;$('stockFeedback').textContent='Salvando estoque…';try{await commitStock(op);closeM();render();}catch(err){$('stockFeedback').textContent='Não foi possível salvar. '+err.message;}finally{busy=false;b.disabled=false;}}
function ledger(){modal(`<h1>Movimentações do estoque</h1><p class="sub">Entradas em lote e ajustes realizados por esta central. Vendas antigas e alterações feitas por outras telas não têm movimentos retroativos inventados; a integração completa depende da atualização do salvamento do sistema.</p>${ops().slice().sort((a,b)=>b.at.localeCompare(a.at)).map(op=>`<article class="b3-box"><b>${op.kind==='count'?'Conferência física':'Entrada em lote'}</b><p class="sub">${esc(new Date(op.at).toLocaleString('pt-BR'))} · ${esc(op.actor)}<br>${esc(op.reason)}</p>${op.items.map(x=>`<div class="cx-result"><span>${esc(x.name)}<br>${x.before} → ${x.after} un.</span><b>${x.delta>0?'+':''}${x.delta} un.</b></div>`).join('')}</article>`).join('')||'<p class="sub">Nenhuma entrada ou conferência registrada nesta central.</p>'}${button('close','','Fechar')}`);}
const previousRender=render;
render=function(){previousRender();if(tab==='prod'){
 const controls=document.createElement('section');controls.className='b3-box';controls.innerHTML=`<h2>Operação do estoque</h2><div class="b3-actions">${button('inbound','','＋ Entrada em lote')}${button('count','','Conferir estoque físico')}${button('ledger','','Ver movimentações')}</div><p class="sub">${window.firebase?'Operações salvas na nuvem, conforme as permissões atuais da sua conta.':'Modo local: movimentações ficam somente neste navegador.'}</p>`;$('app').querySelector('.cx-central').after(controls);
 }};
document.addEventListener('click',e=>{const b=e.target.closest('[data-stock]');if(!b)return;const a=b.dataset.stock;if(a==='inbound')inbound();else if(a==='count')countForm();else if(a==='ledger')ledger();else if(a==='close')closeM();});
render();
})();
