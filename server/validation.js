export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=()=>{throw new HttpError(400,'Некорректный формат композиции.');};
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function shape(s){if(!s||typeof s.chord!=='string'||s.chord.length>40||!Array.isArray(s.frets)||s.frets.length!==6||!s.frets.every(f=>integer(f,-1,12)))fail();return {chord:s.chord,frets:[...s.frets]};}
export function composition(input){
  if(!input||typeof input.title!=='string'||input.title.trim().length<1||input.title.length>120||!integer(input.tempo,40,220)||typeof input.loop!=='boolean'||!Array.isArray(input.bars)||!input.bars.length||input.bars.length>128)fail();
  const bars=input.bars.map(b=>{const base=shape(b);if(!['strum','pick'].includes(b.mode)||!Array.isArray(b.pattern)||![1,2,4,8,16].includes(b.pattern.length)||!b.pattern.every(p=>['down','up','mute','rest'].includes(p))||!Array.isArray(b.notes)||b.notes.length!==b.pattern.length)fail();const notes=b.notes.map(ns=>{if(!Array.isArray(ns)||ns.length>6||new Set(ns.map(n=>n?.s)).size!==ns.length)fail();return ns.map(n=>{if(!n||!integer(n.s,0,5)||!integer(n.f,0,12))fail();return {s:n.s,f:n.f};});});const result={...base,mode:b.mode,pattern:[...b.pattern],notes};
    if(b.changes!==undefined){if(!Array.isArray(b.changes)||b.changes.length>=b.pattern.length||new Set(b.changes.map(c=>c?.step)).size!==b.changes.length)fail();result.changes=b.changes.map(c=>{if(!integer(c?.step,1,b.pattern.length-1))fail();return {...shape(c),step:c.step};}).sort((a,z)=>a.step-z.step);}
    if(b.percussion!==undefined){if(!Array.isArray(b.percussion)||b.percussion.length!==b.pattern.length)fail();result.percussion=b.percussion.map(h=>{if(!Array.isArray(h)||h.length>2||new Set(h).size!==h.length||!h.every(v=>['snap','kick'].includes(v)))fail();return [...h];});}
    return result;
  });
  return {title:input.title.trim(),tempo:input.tempo,loop:input.loop,tone:['original','soft','balanced','bright'].includes(input.tone)?input.tone:'balanced',bars};
}
export function credentials(body,register=false){const login=typeof body.login==='string'?body.login.trim().toLowerCase():'';const password=body.password;if(!/^[a-z0-9_]{3,32}$/.test(login)||typeof password!=='string'||password.length>128||password.length<(register?15:1))throw new HttpError(400,register?'Логин: 3–32 латинские буквы, цифры или _. Пароль: 15–128 символов.':'Укажи логин и пароль.');return {login,password};}
