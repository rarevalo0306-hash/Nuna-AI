const cities=require('./data/cities.json');
function approximateLocation(point,now=Date.now()){
 if(!point||point.consent!==true||typeof point.latitude!=='number'||typeof point.longitude!=='number'||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180||!Number.isFinite(point.timestamp)||now-point.timestamp>600000||point.timestamp>now+60000)return null;
 const latitude=Math.round(point.latitude*100)/100,longitude=Math.round(point.longitude*100)/100;
 const accuracyMeters=Math.max(1500,Number.isFinite(point.accuracyMeters)?Math.min(Math.max(0,point.accuracyMeters),20000000):1500);
 const rad=Math.PI/180;let nearest=null,distance=Infinity;
 for(const city of cities){const a=Math.sin((city[3]-latitude)*rad/2)**2+Math.cos(latitude*rad)*Math.cos(city[3]*rad)*Math.sin((city[4]-longitude)*rad/2)**2;const km=6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));if(km<distance){nearest=city;distance=km}}
 return{approximate:true,observedAt:new Date(point.timestamp).toISOString(),accuracyMeters,nearbyCity:distance<=50&&accuracyMeters<=10000?{name:nearest[0],region:nearest[1],country:nearest[2],distanceKm:Math.round(distance)}:null};
}
function locationInstructions(point){const location=approximateLocation(point);return location?'\nDevice location shared with consent: '+JSON.stringify(location)+'. This is approximate and names only a nearby mapped city, not a verified address or municipal boundary. Say near that city rather than claiming the exact city. If nearbyCity is null, explain the city could not be identified; never invent an address. Do not imply live movement tracking.':'\nThe user has not shared a fresh location. A time zone does not establish their city; do not guess their location.'}
module.exports={approximateLocation,locationInstructions};
