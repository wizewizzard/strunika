import { scryptAsync } from '@noble/hashes/scrypt.js';
import { HttpError } from './validation.js';
export const COOKIE='__Host-strunika_session';
const SESSION_SECONDS=60*60*24*14;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=value=>Uint8Array.from(value.match(/../g)||[],v=>parseInt(v,16));
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
let hashing=false;
async function derive(password,salt){if(hashing)throw new HttpError(429,'Вход занят. Попробуй через несколько секунд.');hashing=true;try{return hex(await scryptAsync(password,bytes(salt),{N:32768,r:8,p:3,dkLen:32,maxmem:48*1024*1024}));}finally{hashing=false;}}
export async function hashPassword(password){const salt=randomToken();return `scrypt:32768:8:3:${salt}:${await derive(password,salt)}`;}
export async function checkPassword(password,stored){const fields=(stored||'').split(':');const valid=fields.length===6&&fields.slice(0,4).join(':')==='scrypt:32768:8:3'&&/^[a-f0-9]{64}$/.test(fields[4])&&/^[a-f0-9]{64}$/.test(fields[5]);const salt=valid?fields[4]:'0'.repeat(64),expected=valid?fields[5]:'0'.repeat(64);const actual=await derive(password,salt);let difference=0;for(let i=0;i<64;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return valid&&difference===0;}
export function tokenFrom(request){const value=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
export const sessionCookie=token=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
export const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export async function currentUser(request,db){const token=tokenFrom(request);if(!token)return null;const row=await db.prepare('SELECT u.id, u.login FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first();return row||null;}
export async function createSession(db,userId){const token=randomToken(),hash=await digest(token),now=Date.now();await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 9)').bind(userId,userId),db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hash,userId,now+SESSION_SECONDS*1000)]);return token;}
export async function rateLimit(db,key,limit,windowMs){const now=Date.now(),bucket=Math.floor(now/windowMs);const hashed=await digest(key+':'+bucket);const row=await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hashed,(bucket+1)*windowMs).first();if(row.count>limit)throw new HttpError(429,'Слишком много попыток. Попробуй позже.');}
