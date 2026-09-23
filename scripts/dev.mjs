import './build.mjs';
import { Miniflare } from 'miniflare';
import { readdir,readFile } from 'node:fs/promises';
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-15',d1Databases:{DB:'strunika-local'},d1Persist:'work/local-d1',port:4173,host:'127.0.0.1'});
const db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)').run();
for(const name of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort()){
 if(await db.prepare('SELECT name FROM local_migrations WHERE name=?').bind(name).first())continue;
 for(const statement of (await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(statement).run();
 await db.prepare('INSERT INTO local_migrations(name) VALUES(?)').bind(name).run();
}
console.log('Strunika preview: '+await mf.ready);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0);});
