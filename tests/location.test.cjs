const {test}=require('node:test');const assert=require('node:assert/strict');const {approximateLocation,locationInstructions}=require('../api/_location');const vm=require('node:vm');const fs=require('node:fs');
test('shared point produces a nearby mapped city, without exposing coordinates to the model',()=>{
 const point={consent:true,latitude:25.7617,longitude:-80.1918,accuracyMeters:20,timestamp:Date.now()};const area=approximateLocation(point);assert.equal(area.nearbyCity.name,'Miami');assert.equal(area.approximate,true);assert.ok(area.accuracyMeters>=1500);assert.equal(area.latitude,undefined);assert.equal(area.longitude,undefined);
 assert.match(locationInstructions(point),/near that city/);assert.match(locationInstructions(null),/do not guess/);
});
test('rejects unconsented, old, future and invalid coordinates; cannot invent a city for distant/uncertain locations',()=>{
 const base={consent:true,latitude:25.7617,longitude:-80.1918,timestamp:Date.now()};
 for(const point of [{...base,consent:false},{...base,timestamp:Date.now()-700000},{...base,timestamp:Date.now()+90000},{...base,latitude:91},{...base,longitude:NaN}])assert.equal(approximateLocation(point),null);
 assert.equal(approximateLocation({...base,latitude:0,longitude:0}).nearbyCity,null);assert.equal(approximateLocation({...base,accuracyMeters:200000}).nearbyCity,null);
});
test('location is scoped to the consenting account and late grants cannot undo revocation',async()=>{
 const stored=new Map();let succeed,calls=0,stopped=0;const element=()=>({append(){},setAttribute(){},remove(){},style:{}});
 const env={navigator:{geolocation:{getCurrentPosition(success){calls++;succeed=success}}},authUser:{id:'account-a'},lang:'es',voiceConnection:null,voiceStarting:false,stopRealVoice(){stopped++},
  localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},document:{createElement:element,head:element(),getElementById:()=>null,querySelector:element},window:{addEventListener(){}},Date,Number,Math,Promise};
 vm.createContext(env);vm.runInContext(fs.readFileSync('location.js','utf8')+'\nthis.testLocation={locationForAI,requestNunaLocation,rememberLocationChoice,stopLocation};',env);const api=env.testLocation;
 assert.equal(await api.requestNunaLocation(),false);assert.equal(calls,0);api.rememberLocationChoice('allow');const request=api.requestNunaLocation();succeed({coords:{latitude:25.76171234,longitude:-80.19182345,accuracy:15}});assert.equal(await request,true);assert.equal(api.locationForAI().latitude,25.76);assert.equal(api.locationForAI().longitude,-80.19);assert.ok([...stored.values()].every(value=>value==='allow'));
 env.authUser={id:'account-b'};api.rememberLocationChoice('allow');assert.equal(api.locationForAI(),null);env.authUser={id:'account-a'};const late=api.requestNunaLocation();api.stopLocation();succeed({coords:{latitude:25,longitude:-80,accuracy:15}});assert.equal(await late,false);assert.equal(api.locationForAI(),null);assert.equal(stopped,0);
});
