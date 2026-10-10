const test=require('node:test'),assert=require('node:assert/strict');
const {jsPDF}=require('../vendor/jspdf.umd.min.js');
const {documentFromText}=require('../pdf.js');
test('long text wraps across pages and retains Spanish accents',()=>{const doc=documentFromText(('Información útil: programación, imágenes y español.\n').repeat(240),'Guía de NUNA',jsPDF);assert.ok(doc.getNumberOfPages()>3);const bytes=doc.output();assert.ok(bytes.startsWith('%PDF-'));assert.ok(bytes.includes('Información'));assert.ok(bytes.includes('/Type /Page'));});
test('iPad prepares PDF without navigation and only opens native save on second tap',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let shares=0,anchors=0;const actions={children:[],append(...items){this.children.push(...items)}};
 const make=tag=>{if(tag==='a')anchors++;return {style:{},disabled:false,textContent:'',setAttribute(name,value){this[name]=value},append(){}}};
 const context={window:{jspdf:{jsPDF}},document:{createElement:make,createElementNS:(ns,tag)=>({...make(tag),namespaceURI:ns}),getElementById:()=>({}),querySelectorAll:()=>[{querySelector:()=>actions,append(){}}]},navigator:{userAgent:'iPad',platform:'',maxTouchPoints:5,canShare:()=>true,share:async data=>{shares++;assert.equal(data.files[0].type,'application/pdf');throw Object.assign(new Error(),{name:'AbortError'})}},MutationObserver:class{observe(){}disconnect(){}},render(){},all:()=>[{id:'test',title:'Prueba',messages:[['assistant','Documento de prueba']]}],active:'test',lang:'es',authUser:null,File,URL,setTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../media-actions.js'),'utf8'),context);context.NunaMediaActions=context.window.NunaMediaActions;
 vm.runInNewContext(fs.readFileSync(require.resolve('../pdf.js'),'utf8'),context);
 await actions.children[0].onclick();assert.equal(shares,0);assert.equal(anchors,2);assert.equal(actions.children[2].target,'_blank');assert.equal(actions.children[2].textContent,'👁');assert.equal(actions.children[1]['aria-label'],'Descargar PDF');
 await actions.children[1].onclick();assert.equal(shares,1);assert.equal(anchors,2);assert.equal(actions.children[3].textContent,'Guardado cancelado.');assert.equal(actions.children[1].disabled,false);actions.children=[];context.render();assert.equal(actions.children[2].textContent,'👁');context.authUser={id:'other'};actions.children=[];context.render();assert.equal(actions.children.length,1);
});
test('explicit PDF request prepares on complete reply once and isolates account changes',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let stores=0,shares=0,actions;
 const chat={id:'chat',title:'Documento',messages:[['user','Créame un PDF con esta información'],['assistant','Documento completo con información útil.']]};
 const make=()=>({style:{},disabled:false,textContent:'',setAttribute(name,value){this[name]=value},append(){},scrollIntoView(){}});
 const context={window:{jspdf:{jsPDF},NunaArtifacts:{store:async()=>{stores++}}},document:{createElement:make,createElementNS:(ns,tag)=>({...make(tag),namespaceURI:ns}),getElementById:()=>({}),querySelectorAll:()=>[{querySelector:()=>({append(){}}),append(){}},{querySelector:()=>actions,append(){}}]},navigator:{userAgent:'iPad',canShare:()=>true,share:async()=>{shares++}},MutationObserver:class{observe(){}disconnect(){}},render(){actions={children:[],append(...items){this.children.push(...items)}}},all:()=>[chat],custom:[chat],active:'chat',lang:'es',authUser:{id:'owner'},File,URL,setTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../media-actions.js'),'utf8'),context);context.NunaMediaActions=context.window.NunaMediaActions;
 vm.runInNewContext(fs.readFileSync(require.resolve('../pdf.js'),'utf8'),context);assert.equal(actions.children.length,1);
 context.window.NunaPDF.onReply(chat,1,'owner');await new Promise(resolve=>setImmediate(resolve));assert.equal(actions.children[0].textContent,'PDF guardado en Documentos');assert.equal(actions.children[1]['aria-label'],'Descargar PDF');assert.equal(shares,0);assert.equal(stores,1);
 context.window.NunaPDF.onReply(chat,1,'owner');context.render();await new Promise(resolve=>setImmediate(resolve));assert.equal(stores,1);assert.equal(actions.children[2].textContent,'👁');
 context.authUser={id:'other'};context.render();context.window.NunaPDF.onReply(chat,1,'owner');assert.equal(actions.children.length,1);assert.equal(stores,1);
});
