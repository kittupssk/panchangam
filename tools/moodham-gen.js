// Regenerates the MOODHAM table in src/hora-chart.html (Guru within 11 deg of the Sun; Sukra within 10 deg, 8 deg while retrograde).
// Usage: npm run moodham > /tmp/m.js, then replace the `const MOODHAM = ...` line in src/hora-chart.html.
const A=require('astronomy-engine');
const lon=(b,t)=>A.Ecliptic(A.GeoVector(b,t,true)).elon;
const elong=(b,t)=>{let d=lon(b,t)-lon(A.Body.Sun,t);return ((d+540)%360)-180;};
const speed=(b,t)=>{let d=lon(b,t.AddDays(0.5))-lon(b,t.AddDays(-0.5));return ((d+540)%360)-180;};
function scan(b,lim,y0,y1){const out=[];let t=A.MakeTime(new Date(Date.UTC(y0,0,1)));const f=(t)=>Math.abs(elong(b,t))<lim(t);let inP=f(t),st=inP?t:null;
 while(t.date.getUTCFullYear()<y1){const n=t.AddDays(1/4);const v=f(n);if(v!==inP){let a=t,bb=n;for(let k=0;k<30;k++){const m=A.MakeTime(new Date((a.date.getTime()+bb.date.getTime())/2));if(f(m)===v)bb=m;else a=m;}
   if(v)st=bb;else if(st)out.push([Math.round(st.date.getTime()/60000)*60000,Math.round(bb.date.getTime()/60000)*60000]);inP=v;} t=n;}
 return out;}
const g=scan(A.Body.Jupiter,()=>11,2025,2041), s=scan(A.Body.Venus,t=>speed(A.Body.Venus,t)<0?8:10,2025,2041);
console.log('const MOODHAM = { guru: '+JSON.stringify(g)+', sukra: '+JSON.stringify(s)+' };');
