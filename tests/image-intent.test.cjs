const {test}=require('node:test');
const assert=require('node:assert/strict');
const {imageRequest}=require('../image-intent');
test('natural Spanish and English image requests reach creation',()=>{
 for(const prompt of ['Crea una imagen de un pez','¿Me puedes hacer una imagen de una casa?','Quiero una foto de un paisaje','Diseña un logo para mi negocio','Puedes crear una ilustración de un perro','Draw a teal fish','Make me a picture of a forest'])assert.equal(imageRequest(prompt),true,prompt);
});
test('image advice, negation and video requests do not trigger paid creation',()=>{
 for(const prompt of ['Cómo crear una imagen','No quiero una imagen','No me hagas una foto','Do not create an image','Explain how to create an image','Qué es una imagen','Anima esta imagen en un video','Create a video from this image','Una foto','Hola'])assert.equal(imageRequest(prompt),false,prompt);
});
