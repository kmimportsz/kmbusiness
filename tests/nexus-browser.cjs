const { chromium,webkit }=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const engine=process.env.KM_BROWSER==='webkit'?'webkit':'chromium';
 const browser=engine==='webkit'?await webkit.launch():await chromium.launch({
  executablePath:process.env.KM_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']
 });
 const origin=process.env.KM_TEST_ORIGIN||'http://127.0.0.1:8855';
 const stock={products:[
  {id:'camiseta',brand:'Marca fictícia',model:'Camiseta A',size:'M',price:80,photo:'/images/one',measurements:[{label:'Comprimento',value:64,unit:'cm'}]},
  {id:'outra',brand:'Marca fictícia',model:'Regata B',size:'G',price:45,photo:'/images/one'},
  {id:'esgotada',brand:'Marca fictícia',model:'Camiseta Z',size:'P',price:65,photo:'/images/one',available:false}],phone:'5511999999999'};
 const output=process.env.KM_EVIDENCE_DIRECTORY||require('node:os').tmpdir()+'/km-nexus-'+engine;
 fs.mkdirSync(output,{recursive:true});
 for(const [label,width,height,reducedMotion] of [['mobile',320,740,'no-preference'],['desktop',1280,830,'no-preference'],['reduced',390,800,'reduce']]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion});
  let posts=0,popups=0,firstKey,error;
  let release;
  const waiting=new Promise(resolve=>release=resolve);
  page.on('popup',()=>popups++);
  page.on('pageerror',e=>error=e);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin===origin&&u.pathname.endsWith('/assets/order-firestore.js')){
    return route.fulfill({contentType:'text/javascript',body:`export async function submitOrder(order){
     const response=await fetch('https://catalog.example.invalid/api/orders',{method:'POST',body:JSON.stringify({
      key:order.key,name:order.customer,notes:order.notes
     })});
     return {...await response.json(),fingerprint:order.fingerprint};
    }`});
   }
   if(u.origin===origin)return route.continue();
   if(u.pathname==='/images/one')return route.fulfill({contentType:'image/svg+xml',body:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#172030"/><path d="M107 63l-41 18-29 45 38 22 20-19v112h110V129l20 19 38-22-29-45-41-18c-10 26-76 26-86 0z" fill="#b9c4d6" stroke="#70849e" stroke-width="4"/></svg>'});
   if(u.pathname==='/api/catalog')return route.fulfill({json:stock});
   if(u.pathname==='/api/catalog-visit')return route.fulfill({json:{total:1}});
   if(u.pathname==='/api/orders'){
    const request=route.request().postDataJSON();posts++;
    firstKey??=request.key;
    assert.equal(request.key,firstKey);assert.equal(request.notes,'');
    if(label==='mobile'&&posts===1)return route.abort();
    if(label==='desktop')await waiting;
    return route.fulfill({status:201,json:{code:firstKey.replaceAll('-','').toUpperCase(),items:[{...stock.products[0],quantity:1,priceCents:8000}],
     subtotalCents:8000,shippingCents:0,phone:stock.phone,customer:request.name,mode:'pickup',notes:'',address:null}});
   }
   return route.abort();
  });
  await page.goto(origin+'/catalogo/');
  await page.locator('#grid [data-select="camiseta"]').waitFor();
  assert.equal(await page.locator('aside.checkout').count(),0);
  assert.equal(await page.locator('#dockHome').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.catalog-electric-head animateMotion').getAttribute('dur'),'5.143s');
  await page.locator('#dockSearch').click();
  assert.equal(await page.locator('#dockSearch').getAttribute('aria-pressed'),'true');
  const navigationState=await page.evaluate(()=>{
   window.dispatchEvent(new Event('scroll'));
   const trace=document.querySelector('.catalog-dock-trace');
   return {dimmed:document.documentElement.hasAttribute('data-dock-dimmed'),paused:trace.animationsPaused()};
  });
  assert.equal(navigationState.dimmed,true);
  assert.equal(navigationState.paused,reducedMotion==='reduce');
  await page.locator('#search').fill('camizeta');
  const favorite=page.locator('[data-discovery="favorite"][data-model="camiseta"]');
  await favorite.click();
  assert.equal(await favorite.getAttribute('aria-pressed'),'true');
  assert.equal(await favorite.locator('.discovery-heart').evaluate(heart=>getComputedStyle(heart).fill),'rgb(112, 169, 255)');
  await page.locator('#showCatalogFavorites').click();
  await page.locator('[data-discovery="compare"][data-model="camiseta"]').click();
  await page.locator('#showCatalogCompare').click();
  await page.locator('#catalogCompareContent').getByText('Camiseta A').click();
  await page.locator('#toggleProductZoom').click();
  assert.equal(await page.locator('#toggleProductZoom').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#catalogMeasurementGuide').getAttribute('hidden'),null);
  await page.locator('#closeProductDetails').click();
  await page.locator('#showCatalogFavorites').click();
  const photo=page.locator('#grid [data-product="camiseta"]');
  await photo.scrollIntoViewIfNeeded();
  await photo.focus();
  const beforeDetails=await page.evaluate(()=>window.scrollY);
  await photo.press('Enter');
  await page.locator('#closeProductDetails').click();
  await page.waitForFunction(y=>window.scrollY===y&&document.activeElement?.dataset.product==='camiseta',beforeDetails);
  await page.locator('#search').clear();
  await page.locator('#dockHome').focus();
  const addition=await page.evaluate(()=>{
   const click=selector=>document.querySelector(selector).click();
   click('#grid [data-select="camiseta"]');
   click('#grid [data-catalog-qty="camiseta"][data-dir="1"]');
   click('#grid [data-select="outra"]');
   const count=document.querySelector('#dockCartCount'),pulse=document.querySelector('#dockBagPulse');
   const unavailable=[...document.querySelectorAll('#grid .select[disabled]')].find(b=>b.getAttribute('aria-label').includes('Camiseta Z'));
   unavailable.click();
   return {count:count.textContent,announcement:document.querySelector('#dockCartStatus').textContent,
    flights:document.querySelectorAll('.catalog-bag-flight').length,pulse:pulse.getAnimations().length,badge:count.getAnimations().length};
  });
  assert.equal(addition.count,'3');
  assert.equal(await page.locator('#cartCount').textContent(),'3');
  assert.match(addition.announcement,/3 unidades/);
  if(reducedMotion==='reduce')assert.deepEqual([addition.flights,addition.pulse,addition.badge],[0,0,0]);
  else assert.deepEqual([addition.flights>0,addition.pulse===1,addition.badge===1],[true,true,true]);
  if(label==='mobile'){
   await page.locator('#grid [data-catalog-qty="outra"][data-dir="-1"]').click();
   await page.locator('#grid [data-catalog-qty="camiseta"][data-dir="-1"]').click();
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#dockCartCount')?.textContent==='1');
   assert.equal(await page.locator('#dockCartCount').textContent(),'1');
  }else{
   await page.locator('#grid [data-catalog-qty="outra"][data-dir="-1"]').click();
   await page.locator('#grid [data-catalog-qty="camiseta"][data-dir="-1"]').click();
  }
  assert.equal(await page.locator('#dockCartCount').textContent(),'1');
  const dockRatio=(await page.locator('#checkout').boundingBox()).width/width;
  if(width<500)assert.ok(dockRatio>=.75&&dockRatio<=.8);
  assert.ok(await page.locator('#checkout button').evaluateAll(buttons=>buttons.every(b=>b.offsetWidth>=44&&b.offsetHeight>=44)));
  if(label==='mobile'){
   await page.screenshot({path:output+'/mobile-menu.png'});
   const add=page.locator('#grid [data-catalog-qty="camiseta"][data-dir="1"]');
   await add.scrollIntoViewIfNeeded();
   await page.evaluate(()=>{
    document.querySelector('#grid [data-catalog-qty="camiseta"][data-dir="1"]').click();
    window.interactionAnimations=[...document.querySelectorAll('.catalog-bag-flight,#dockBagPulse,#dockCartCount')]
     .flatMap(el=>el.getAnimations()).filter(animation=>animation.playState==='running');
    window.interactionAnimations.forEach(animation=>animation.pause());
   });
   for(let i=0;i<10;i++){
    await page.evaluate(t=>window.interactionAnimations.forEach(animation=>{animation.currentTime=t}),i*37);
    await page.screenshot({path:output+'/bag-'+String(i).padStart(2,'0')+'.png'});
   }
   await page.evaluate(()=>window.interactionAnimations.forEach(animation=>animation.finish()));
   await page.locator('#grid [data-catalog-qty="camiseta"][data-dir="-1"]').click();
   for(let i=0;i<16;i++){
    await page.screenshot({path:output+'/dock-'+String(i).padStart(2,'0')+'.png'});
    await page.waitForTimeout(90);
   }
  }
  await page.locator('#send').click();
  await page.locator('#summaryDialog').waitFor();
  assert.equal(await page.locator('#hero #kmCinema').count(),1);
  assert.equal(await page.locator('#summaryDialog #kmCinema').count(),0);
  assert.equal(await page.locator('#summaryDialog .checkout-brand').isVisible(),true);
  assert.equal(await page.locator('#summaryDialog .summary-bottom').evaluate(el=>getComputedStyle(el).position),'static');
  const bagRect=await page.locator('#summaryDialog').boundingBox();
  assert.equal(Math.round(bagRect.width),width);
  assert.equal(Math.round(bagRect.height),height);
  assert.equal(await page.locator('#summaryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.locator('#summaryItems [data-remove]').click();
  assert.notEqual(await page.locator('#dockCartCount').getAttribute('hidden'),null);
  assert.equal(await page.locator('#dockCartStatus').textContent(),'Sacola vazia.');
  assert.equal(await page.locator('#confirmOrder').isVisible(),false);
  await page.locator('#undoBagRemoval').click();
  assert.equal(await page.locator('#dockCartCount').textContent(),'1');
  const address=page.locator('#deliveryAddressFields');
  await page.locator('input[name="deliveryMode"][value="delivery"]').check();
  assert.equal(await address.isVisible(),true);
  await page.locator('input[name="deliveryMode"][value="pickup"]').check();
  assert.equal(await address.isVisible(),false);
  await page.locator('#customerName').fill('Pessoa Teste');
  await page.locator('#rememberOrderName').check();
  await page.locator('[name=deliveryMode][value=pickup]').check();
  await page.locator('#confirmOrder').click();
  if(label==='mobile'){
   await page.waitForFunction(()=>document.querySelector('#checkoutHelp').textContent.length>0&&!document.querySelector('#nexusResult').open);
   assert.equal(await page.locator('#customerName').inputValue(),'Pessoa Teste');
   await page.locator('#confirmOrder').click();
  }
  if(label==='desktop'){
   await page.locator('#nexusWaiting').waitFor();
   await page.evaluate(()=>document.getElementById('confirmOrder').click());
   assert.equal(popups,0);
   await page.screenshot({path:output+'/desktop-registrando.png'});
   release();
   for(let i=0;i<16;i++){
    await page.screenshot({path:output+'/frame-'+String(i).padStart(2,'0')+'.png'});
    await page.waitForTimeout(45);
   }
  }
  await page.locator('#nexusResult[data-state=success]').waitFor();
  if(reducedMotion==='no-preference')await page.waitForTimeout(1300);
  else {
   assert.equal(await page.locator('.nexus-arc').evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.equal(await page.locator('.catalog-electric-head').evaluate(el=>getComputedStyle(el).display),'none');
  }
  assert.equal(await page.locator('#nexusTitle').textContent(),'Pedido efetuado com sucesso!');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  assert.equal(await page.locator('#nexusResult').evaluate(el=>el.scrollWidth),await page.locator('#nexusResult').evaluate(el=>el.clientWidth));
  assert.equal(posts,label==='mobile'?2:1);
  assert.equal(popups,0);
  const url=new URL(await page.locator('#nexusWhatsApp').getAttribute('href'));
  const message=url.searchParams.get('text');
  assert.ok(message.includes('Camiseta A')&&message.includes('80,00')&&!message.includes('Observações:')&&!message.includes('Referência:'));
  await page.screenshot({path:output+'/'+label+'-confirmado.png'});
  await page.evaluate(()=>{
   Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.kmCopied=text}},configurable:true});
  });
  assert.equal(await page.locator('#nexusCopy, #nexusNumber').count(),0);
  assert.ok(!message.includes(firstKey.replaceAll('-','').toUpperCase()));
  assert.equal(await page.evaluate(()=>localStorage.getItem('km.catalog.remembered-name.v1')),'Pessoa Teste');
  await page.locator('#nexusBack').click();
  assert.equal(await page.locator('#summaryDialog').evaluate(el=>el.open),false);
  await page.locator('#send').click();
  await page.locator('#forgetOrderName').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('km.catalog.remembered-name.v1')),null);
  await page.locator('#clearChoices').click();
  assert.notEqual(await page.locator('#dockCartCount').getAttribute('hidden'),null);
  assert.equal(await page.locator('#dockCartStatus').textContent(),'Sacola vazia.');
  if(label==='mobile'){
   await page.locator('#continueShopping').click();
   await page.locator('.catalog-discovery details > summary').click();
   await page.locator('#catalogRememberBrowsing').check();
   const search=page.locator('#search');
   await search.fill('Camiseta');
   await search.blur();
   await page.locator('#grid [data-product="camiseta"]').click();
   await page.locator('#quickProductPurchase').click();
   await page.locator('#summaryDialog').waitFor();
   assert.equal(await page.locator('#dockCartCount').textContent(),'1');
   await page.locator('#shareBag').click();
   const shared=new URL(await page.evaluate(()=>window.kmCopied));
   assert.deepEqual(JSON.parse(shared.searchParams.get('sacola')),[['camiseta',1]]);
   await page.locator('#continueShopping').click();
   assert.equal(await page.locator('#showCatalogRecent').getAttribute('hidden'),null);
   await page.locator('#showCatalogRecent').click();
   assert.equal(await page.locator('#grid [data-product]').count(),1);
   let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('km.catalog.discovery.v1')));
   assert.deepEqual(saved.products,['camiseta']);
   assert.ok(saved.searches.includes('Camiseta'));
   await page.locator('#clearCatalogDiscovery').click();
   saved=await page.evaluate(()=>localStorage.getItem('km.catalog.discovery.v1'));
   assert.equal(saved,null);
  }
  assert.ifError(error);
  await page.close();
 }
 if(engine==='chromium'){
  const page=await browser.newPage({viewport:{width:1280,height:830}});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===origin)return route.continue();
   if(url.pathname==='/api/catalog')return route.fulfill({json:stock});
   return route.abort();
  });
  await page.addInitScript(()=>{
   const users={uid:'operator',email:'operator@example.invalid'};
   const state={
    products:{camiseta:{id:'camiseta',name:'Camiseta A',brand:'Marca fictícia',stock:5,cost:38,price:80,catalogId:'camiseta'}},
    sales:{},catalog:{},cphotos:{},expenses:{},closings:{},config:{},proofs:{},
    nexusOrders:{test:{code:'A'.repeat(32),status:'pending',customer:'Pessoa Teste',createdAt:'2026-11-25T12:00:00.000Z',
     items:[{id:'camiseta',brand:'Marca fictícia',model:'Camiseta A',size:'M',quantity:1,priceCents:8000}],
     subtotalCents:8000,shippingCents:0,mode:'pickup',notes:''}}
   };
   const listeners={};
   function snapshot(name){
    const docs=Object.entries(state[name]||{}).map(([id,value])=>({id,data:()=>structuredClone(value)}));
    return {docs,forEach:fn=>docs.forEach(fn),metadata:{fromCache:false}};
   }
   function emit(name){setTimeout(()=>listeners[name]?.forEach(fn=>fn(snapshot(name))),0)}
   const cloud={
    enablePersistence:async()=>{},
    collection(name){return {
     doc(id){return {name,id,set:async value=>{state[name][id]=value;emit(name)},delete:async()=>{delete state[name][id];emit(name)}}},
     onSnapshot(opts,callback){
      const fn=typeof opts==='function'?opts:callback;
      (listeners[name]??=new Set()).add(fn);
      setTimeout(()=>fn(snapshot(name)),0);
      return ()=>listeners[name].delete(fn);
     }
    }},
    async runTransaction(fn){
     const changes=[];
     await fn({
      async get(ref){const row=state[ref.name][ref.id];return {exists:!!row,data:()=>structuredClone(row)}},
      set(ref,value){changes.push(()=>{state[ref.name][ref.id]=value;emit(ref.name)})},
      update(ref,delta){changes.push(()=>{Object.assign(state[ref.name][ref.id],delta);emit(ref.name)})}
     });
     changes.forEach(change=>change());
    }
   };
   window.firebase={initializeApp(){},auth:()=>({currentUser:users,onAuthStateChanged:fn=>setTimeout(()=>fn(users),10)}),firestore:()=>cloud};
   window.kmBrowserFixture=state;
  });
  await page.goto(origin+'/');
  const orders=page.locator('.v-side-links [data-visual="orders"]');
  await orders.getByText('(1)',{exact:true}).waitFor();
  await orders.click();
  const card=page.locator('#nexusOrdersPanel .nexus-order').first();
  await card.getByRole('heading',{name:'Pessoa Teste'}).waitFor();
  await card.locator('img').waitFor();
  assert.equal(await card.locator('img').getAttribute('src'),'https://km-camisetas-catalogo.inventivetoucan16.chatgpt.site/images/one');
  assert.ok(!(await card.textContent()).includes('PEDIDO-TEST'));
  await page.screenshot({path:output+'/business-pedidos.png'});
  await page.locator('#nexusOrdersPanel [data-nexus-action="confirm"]').click();
  await page.locator('#nexusForm button').first().click();
  await page.waitForFunction(()=>window.kmBrowserFixture.sales['pedido-test']);
  const result=await page.evaluate(()=>({sale:window.kmBrowserFixture.sales['pedido-test'],stock:window.kmBrowserFixture.products.camiseta.stock}));
  assert.equal(result.stock,4);assert.equal(result.sale.price,80);assert.deepEqual(result.sale.inst,[]);
  await page.locator('.v-side-links [data-visual="sales"]').click();
  await page.locator('#app details summary').filter({hasText:'Pessoa Teste'}).click();
  await page.locator('#app [data-nexus-action="charge"]').click();
  await page.locator('#nexusForm [name=amount]').fill('25');
  await page.locator('#nexusForm [name=due]').fill('2027-01-20');
  await page.locator('#nexusForm button').first().click();
  await page.waitForFunction(()=>window.kmBrowserFixture.sales['pedido-test'].inst.length===1);
  await page.close();
 }
 await browser.close();
 console.log('PASS '+engine+': 320 px, desktop, movimento reduzido, resposta perdida, duplo clique e WhatsApp exclusivamente opcional.');
})().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),100)});
