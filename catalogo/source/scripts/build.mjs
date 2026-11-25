import{mkdirSync,copyFileSync,readFileSync,writeFileSync}from'node:fs';
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
const observability=readFileSync('worker/observability.js','utf8').replace(/export /g,'');
const orders=readFileSync('worker/orders.js','utf8').replace(/^export /gm,'');
const worker=readFileSync('worker/index.js','utf8').replace("import {orderEndpoint} from './orders.js';\n",'').replace("import {observabilityEndpoint} from './observability.js';\n",'');
writeFileSync('dist/server/index.js',observability+'\n'+orders+'\n'+worker);
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
