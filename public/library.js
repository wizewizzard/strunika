import { composition } from '/validation.js';
const $=id=>document.getElementById(id),app=window.Strunika;
let user=null,active=null,snapshot='',busy=false,loading=false,authMode='login',authKnown=false;
const draftKey=id=>'strunika-draft:'+id;
const metaKey=id=>'strunika-active:'+id;
const errorText=message=>{$('libraryMessage').textContent=message;};
function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function storeMeta(){if(user)try{localStorage.setItem(metaKey(user.id),JSON.stringify(active));}catch{}}
const current=()=>{try{return JSON.stringify(composition(app.getData()));}catch{return JSON.stringify(app.getData());}};
const dirty=()=>current()!==snapshot;
async function api(path,method='GET',body){let response;try{response=await fetch(path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Strunika-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw Error('Нет связи с сервером. Изменения остались в браузере.');}let data;try{data=await response.json();}catch{throw Error('Сервер недоступен. Попробуй ещё раз.');}if(!response.ok){const error=new Error(data.error||'Не удалось выполнить запрос.');error.status=response.status;throw error;}return data;}
function status(){
  $('accountName').textContent=user?'@'+user.login:'Без аккаунта';$('signIn').hidden=!!user;$('signOut').hidden=!user;
  $('saveCloud').textContent=user?'Сохранить в аккаунт':'Войти и сохранить';$('saveCopy').hidden=!user;$('newComposition').disabled=busy;$('saveCloud').disabled=busy||!authKnown;$('saveCopy').disabled=busy;$('signOut').disabled=busy;
  $('compositionAuthor').textContent=user?`Автор: ${user.login}${active?'':' · новая композиция'}`:'Локальный черновик';
  $('saved').textContent=user?(active&&!dirty()?'Сохранено в аккаунте':'Изменения в черновике · нажми «Сохранить»'):'Черновик в этом браузере';
}
function applyData(data){loading=true;try{app.setData(composition(data));}finally{loading=false;}}
function activateUser(next){
  const same=user?.id===next.id;user=next;window.strunikaDraftKey=draftKey(user.id);
  if(!same){const stored=readLocal(window.strunikaDraftKey),meta=readLocal(metaKey(user.id));active=meta&&typeof meta.id==='string'&&Number.isInteger(meta.revision)?meta:null;
    if(stored){try{applyData(stored);}catch{active=null;applyData(app.newData());}}
    else{active=null;const guest=readLocal('six-strings-v1');try{applyData(guest||app.newData());}catch{applyData(app.newData());}}
    snapshot=active?.snapshot||'';
  }
  status();
}
function showAuth(mode='login'){authMode=mode;$('authTitle').textContent=mode==='login'?'Вход в Strunika':'Регистрация';$('authSubmit').textContent=mode==='login'?'Войти':'Создать аккаунт';$('authSwitch').textContent=mode==='login'?'Нет аккаунта? Зарегистрироваться':'Уже есть аккаунт? Войти';$('registerHint').hidden=mode!=='register';$('accountPassword').autocomplete=mode==='login'?'current-password':'new-password';$('accountPassword').minLength=mode==='login'?1:15;$('authError').textContent='';if(!$('authDialog').open)$('authDialog').showModal();$('accountLogin').focus();}
$('signIn').onclick=()=>showAuth();$('closeAuth').onclick=()=>{$('accountPassword').value='';$('authDialog').close();};$('authSwitch').onclick=()=>showAuth(authMode==='login'?'register':'login');
$('authForm').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;status();$('authSubmit').disabled=true;$('authError').textContent='';try{const result=await api('/api/account/'+authMode,'POST',{login:$('accountLogin').value,password:$('accountPassword').value});$('accountPassword').value='';activateUser(result.user);$('authDialog').close();errorText('Вход выполнен. Нажми «Сохранить в аккаунт», чтобы добавить текущий черновик в библиотеку.');await list();}catch(error){$('authError').textContent=error.message;}finally{busy=false;$('authSubmit').disabled=false;status();}};
async function saveCloud(copy=false){if(!user){showAuth();return;}if(busy)return;busy=true;status();try{
  const data=composition(app.getData()),sent=JSON.stringify(data);let result;
  if(active&&!copy)result=await api('/api/compositions/'+active.id,'PUT',{data,revision:active.revision});
  else{const id=crypto.randomUUID();result=await api('/api/compositions','POST',{id,data});}
  snapshot=sent;active={id:result.id,revision:result.revision,snapshot};storeMeta();errorText('Сохранено в аккаунте · автор '+result.author);await list();
}catch(error){errorText(error.message);if(error.status===401)showAuth();}finally{busy=false;status();}}
$('saveCloud').onclick=()=>saveCloud();$('saveCopy').onclick=()=>saveCloud(true);
async function list(){if(!user){$('compositionList').replaceChildren();return;}const result=await api('/api/compositions');const list=$('compositionList');list.replaceChildren();if(!result.compositions.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Здесь появятся сохранённые композиции. Текущий черновик можно сохранить кнопкой выше.';list.append(empty);return;}
  for(const item of result.compositions){const row=document.createElement('div');row.className='composition-row';const open=document.createElement('button');open.className='composition-open';const title=document.createElement('strong');title.textContent=item.title;const detail=document.createElement('span');detail.textContent=`Автор: ${item.author} · ${new Date(item.updated_at).toLocaleString('ru-RU')}`;open.append(title,detail);open.onclick=async()=>{if(busy)return;if(dirty()&&!confirm('В черновике есть несохранённые изменения. Открыть другую композицию и заменить черновик?'))return;busy=true;status();try{const saved=await api('/api/compositions/'+item.id);applyData(saved.data);snapshot=current();active={id:saved.id,revision:saved.revision,snapshot};storeMeta();errorText('Открыта «'+saved.data.title+'».');$('libraryPanel').hidden=true;}catch(e){errorText(e.message);}finally{busy=false;status();}};const del=document.createElement('button');del.textContent='Удалить';del.setAttribute('aria-label','Удалить «'+item.title+'»');del.onclick=async()=>{if(busy||!confirm('Удалить из аккаунта «'+item.title+'»? Это действие нельзя отменить.'))return;busy=true;status();try{await api('/api/compositions/'+item.id,'DELETE',{revision:item.revision});if(active?.id===item.id){active=null;snapshot='';storeMeta();}await list();errorText('Удалено из библиотеки. Открытый черновик остаётся в браузере.');}catch(e){errorText(e.message);}finally{busy=false;status();}};row.append(open,del);list.append(row);}
}
$('showLibrary').onclick=async()=>{if(!user){showAuth();return;}$('libraryPanel').hidden=!$('libraryPanel').hidden;if(!$('libraryPanel').hidden)try{await list();}catch(e){errorText(e.message);}};
$('refreshLibrary').onclick=()=>list().catch(e=>errorText(e.message));
$('newComposition').onclick=()=>{if(busy)return;if(dirty()&&!confirm('Начать новую композицию? Несохранённые изменения текущего черновика будут заменены.'))return;active=null;snapshot='';applyData(app.newData());storeMeta();status();errorText('Новая композиция.');};
$('signOut').onclick=async()=>{if(busy)return;if(dirty()&&!confirm('Выйти без сохранения в аккаунт? Черновик останется в этом браузере для следующего входа.'))return;busy=true;status();try{await api('/api/account/logout','POST',{});user=null;active=null;snapshot='';window.strunikaDraftKey='six-strings-v1';const guest=readLocal('six-strings-v1');try{applyData(guest||app.newData());}catch{applyData(app.newData());}$('libraryPanel').hidden=true;$('compositionList').replaceChildren();errorText('Ты вышел из аккаунта.');}catch(e){errorText(e.message);}finally{busy=false;status();}};
window.addEventListener('strunika:changed',()=>{if(!loading)status();});window.addEventListener('beforeunload',event=>{if(user&&dirty()){event.preventDefault();event.returnValue='';}});
try{const result=await api('/api/account/me');if(result.user)activateUser(result.user);}catch(e){errorText(e.message);}finally{authKnown=true;status();}
