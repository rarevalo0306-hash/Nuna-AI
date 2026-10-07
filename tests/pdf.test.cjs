const test=require('node:test'),assert=require('node:assert/strict');
const {jsPDF}=require('../vendor/jspdf.umd.min.js');
const {documentFromText}=require('../pdf.js');
test('long text wraps across pages and retains Spanish accents',()=>{const doc=documentFromText(('Información útil: programación, imágenes y español.\n').repeat(240),'Guía de NUNA',jsPDF);assert.ok(doc.getNumberOfPages()>3);const bytes=doc.output();assert.ok(bytes.startsWith('%PDF-'));assert.ok(bytes.includes('Información'));assert.ok(bytes.includes('/Type /Page'));});
test('iPad prepares PDF without navigation and only opens native save on second tap',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let shares=0,anchors=0;const actions={children:[],append(...items){this.children.push(...items)}};
 const make=tag=>{if(tag==='a')anchors++;return {disabled:false,textContent:'',setAttribute(){},append(){}}};
 const context={window:{jspdf:{jsPDF}},document:{createElement:make,querySelectorAll:()=>[{querySelector:()=>actions}]},navigator:{userAgent:'iPad',platform:'',maxTouchPoints:5,canShare:()=>true,share:async data=>{shares++;assert.equal(data.files[0].type,'application/pdf');throw Object.assign(new Error(),{name:'AbortError'})}},render(){},all:()=>[{id:'test',title:'Prueba',messages:[['assistant','Documento de prueba']]}],active:'test',lang:'es',authUser:null,File,URL,setTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pdf.js'),'utf8'),context);
 await actions.children[0].onclick();assert.equal(shares,0);assert.equal(anchors,0);assert.equal(actions.children[1].textContent,'Guardar en dispositivo');
 await actions.children[1].onclick();assert.equal(shares,1);assert.equal(anchors,0);assert.equal(actions.children[2].textContent,'Guardado cancelado.');assert.equal(actions.children[1].disabled,false);
});
