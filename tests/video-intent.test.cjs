const {test}=require('node:test'),assert=require('node:assert/strict');
const {videoFollowup}=require('../video-intent');
const chat={messages:[['user','Animate'],['assistant','Here is your video']],attachments:{1:[{provider:'r2',type:'video/mp4'}]}};
test('concrete motion follow-ups use latest video context, while ambiguous topics and questions stay text',()=>{assert.equal(videoFollowup('Que tire un beso',chat),true);assert.equal(videoFollowup('Ahora que nade lentamente',chat),true);for(const text of ['oso','¿Qué es un beso?','No quiero que tire un beso','que se quite la ropa'])assert.equal(videoFollowup(text,chat),false)});
test('no stale video context is reused after text replies or in another chat',()=>{assert.equal(videoFollowup('Que tire un beso',{messages:[]}),false);assert.equal(videoFollowup('Que tire un beso',{...chat,messages:[...chat.messages,['assistant','A text response']]}),false)});
