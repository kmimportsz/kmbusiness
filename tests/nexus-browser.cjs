const { chromium,webkit }=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const engine=process.env.KM_BROWSER==='webkit'?'webkit':'chromium';
 const browser=engine==='webkit'?await webkit.launch():await chromium.launch({
  executablePath:process.env.KM_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']
 });
 const origin='http://127.0.0.1:8855';
 const stock={products:[{id:'camiseta',brand:'Marca fictícia',model:'Camiseta A',size:'M',price:80,photo:'/images/one',measurements:[{label:'Comprimento',value:64,unit:'cm'}]}],phone:'5511999999999'};
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
   if(u.origin===origin)return route.continue();
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
  await page.locator('#search').fill('camizeta');
  await page.locator('[data-discovery="favorite"][data-model="camiseta"]').click();
  await page.locator('#showCatalogFavorites').click();
  await page.locator('[data-discovery="compare"][data-model="camiseta"]').click();
  await page.locator('#showCatalogCompare').click();
  await page.locator('#catalogCompareContent').getByText('Camiseta A').click();
  await page.locator('#toggleProductZoom').click();
  assert.equal(await page.locator('#toggleProductZoom').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#catalogMeasurementGuide').getAttribute('hidden'),null);
  await page.locator('#closeProductDetails').click();
  await page.locator('#showCatalogFavorites').click();
  await page.locator('#grid [data-select="camiseta"]').click();
  await page.locator('#send').click();
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
  else assert.equal(await page.locator('.nexus-arc').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('#nexusTitle').textContent(),'Pedido efetuado com sucesso!');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  assert.equal(await page.locator('#nexusResult').evaluate(el=>el.scrollWidth),await page.locator('#nexusResult').evaluate(el=>el.clientWidth));
  assert.equal(posts,label==='mobile'?2:1);
  assert.equal(popups,0);
  const url=new URL(await page.locator('#nexusWhatsApp').getAttribute('href'));
  const message=url.searchParams.get('text');
  assert.ok(message.includes('Camiseta A')&&message.includes('80,00')&&!message.includes('Observações:')&&!message.includes('Referência:'));
  await page.screenshot({path:output+'/'+label+'-confirmado.png'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('km.catalog.remembered-name.v1')),'Pessoa Teste');
  await page.locator('#nexusBack').click();
  assert.equal(await page.locator('#summaryDialog').evaluate(el=>el.open),false);
  assert.ifError(error);
  await page.close();
 }
 await browser.close();
 console.log('PASS '+engine+': 320 px, desktop, movimento reduzido, resposta perdida, duplo clique e WhatsApp exclusivamente opcional.');
})().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),100)});
