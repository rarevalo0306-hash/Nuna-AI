const test=require('node:test'),assert=require('node:assert/strict');
const {jsPDF}=require('../vendor/jspdf.umd.min.js');
const {documentFromText}=require('../pdf.js');
test('long text wraps across pages and retains Spanish accents',()=>{const doc=documentFromText(('Información útil: programación, imágenes y español.\n').repeat(240),'Guía de NUNA',jsPDF);assert.ok(doc.getNumberOfPages()>3);const bytes=doc.output();assert.ok(bytes.startsWith('%PDF-'));assert.ok(bytes.includes('Información'));assert.ok(bytes.includes('/Type /Page'));});
