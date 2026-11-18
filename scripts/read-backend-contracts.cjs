// Read-only contract inspection. Never checks out or changes the backend repository.
const {execFileSync}=require('node:child_process');
const names=process.argv.slice(2);
const base='property-service/src/main/java/com/geointelli/ai/property/service/';
for(const name of names){const code=execFileSync('git',['-C','../../geointelliai-server','show',`origin/master:${base}${name.includes('/')?name:'dto/'+name+'.java'}`],{encoding:'utf8'});console.log('\n'+name+'\n'+code.replace(/^import .*;\r?\n|^package .*;\r?\n/gm,''));}
