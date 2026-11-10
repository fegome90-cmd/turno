// Non-persistent presentation guard. No record writes, no timer, no network.
export function createSuggestionGate({now=Date.now,cooldownMs=60_000,capacity=256}={}){
 if(!Number.isSafeInteger(cooldownMs)||cooldownMs<0||!Number.isSafeInteger(capacity)||capacity<1){throw new Error('Parámetros inválidos.');}
 const seenEvents=new Map();
 const bySuggestion=new Map();
 const boundedSet=(map,key,value)=>{
   if(map.has(key))map.delete(key);
   map.set(key,value);
   if(map.size>capacity)map.delete(map.keys().next().value);
 };
 return Object.freeze({filter(eventId,suggestions){
   if(typeof eventId!=='string'||!eventId||!Array.isArray(suggestions))return [];
   if(seenEvents.has(eventId))return [];
   const time=now();
   boundedSet(seenEvents,eventId,time);
   const valid=suggestions.filter(s=>s?.requiresReview===true&&typeof s.id==='string'&&s.id.trim()&&typeof s.message==='string'&&s.message.trim());
   const selected=[];
   for(const suggestion of valid){
     const previous=bySuggestion.get(suggestion.id);
     if(previous!==undefined && time-previous<cooldownMs)continue;
     boundedSet(bySuggestion,suggestion.id,time);
     selected.push(suggestion);
   }
   return selected;
 }});
}
