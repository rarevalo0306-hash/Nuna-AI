let projects=[],hiddenChats=[],assignments={},currentProject=null,selecting=false,selectedChats=new Set();
try{projects=JSON.parse(localStorage.getItem('nuna-projects')||'[]');hiddenChats=JSON.parse(localStorage.getItem('nuna-hidden')||'[]');assignments=JSON.parse(localStorage.getItem('nuna-assignments')||'{}')}catch{}
function persistProjects(){try{localStorage.setItem('nuna-projects',JSON.stringify(projects));localStorage.setItem('nuna-hidden',JSON.stringify(hiddenChats));localStorage.setItem('nuna-assignments',JSON.stringify(assignments))}catch{}}
const projectSection=document.createElement('section');projectSection.className='project-section';projectSection.innerHTML='<div class="project-heading"><span id="projects-label"></span><button class="project-add" id="project-add">＋</button></div><div id="project-list"></div><div class="sidebar-tools"><button id="select-chats"></button><button id="delete-selected" hidden></button></div><div class="project-toolbar" id="project-assignment"></div>';document.querySelector('.history-label').before(projectSection);
function refreshProjects(){const es=lang==='es';document.getElementById('projects-label').textContent=es?'PROYECTOS':'PROJECTS';document.getElementById('project-add').setAttribute('aria-label',es?'Crear proyecto':'Create project');const list=document.getElementById('project-list');list.replaceChildren();[{id:null,name:es?'Todas las conversaciones':'All conversations'},...projects].forEach(p=>{const b=document.createElement('button');b.textContent=(p.id?'▱  ':'☷  ')+p.name;b.classList.toggle('active',currentProject===p.id);b.onclick=()=>{currentProject=p.id;active=null;selectedChats.clear();render()};list.append(b)});const select=document.getElementById('select-chats');select.textContent=selecting?(es?'Cancelar selección':'Cancel selection'):(es?'Seleccionar chats':'Select chats');select.onclick=()=>{selecting=!selecting;selectedChats.clear();render()};const del=document.getElementById('delete-selected');del.hidden=!selecting;del.disabled=!selectedChats.size;del.textContent=(es?'Borrar':'Delete')+' ('+selectedChats.size+')';del.onclick=()=>deleteChats([...selectedChats],del);const area=document.getElementById('project-assignment');area.replaceChildren();const selectedProject=projects.find(p=>p.id===currentProject);if(selectedProject?.description){const details=document.createElement('p');details.className='project-description';details.textContent=selectedProject.description;area.append(details)}if(active){const label=document.createElement('label');label.textContent=es?'Mover conversación a proyecto':'Move conversation to project';const dropdown=document.createElement('select');const none=document.createElement('option');none.value='';none.textContent=es?'Sin proyecto':'No project';dropdown.append(none);projects.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;dropdown.append(o)});dropdown.value=assignments[active]||custom.find(c=>c.id===active)?.project||'';dropdown.onchange=()=>{assignments[active]=dropdown.value;const chat=custom.find(c=>c.id===active);if(chat)chat.project=dropdown.value;persistProjects();save();render()};label.append(dropdown);area.append(label)}document.getElementById('project-add').onclick=()=>openProjectCreator();}
function decorateChat(button,chat){const project=assignments[chat.id]??chat.project;if(hiddenChats.includes(chat.id)||(currentProject&&project!==currentProject)){return}const row=document.createElement('div');row.className='history-row';if(selecting){const check=document.createElement('input');check.type='checkbox';check.checked=selectedChats.has(chat.id);check.setAttribute('aria-label',(lang==='es'?'Seleccionar ':'Select ')+button.textContent);check.onchange=()=>{if(check.checked)selectedChats.add(chat.id);else selectedChats.delete(chat.id);refreshProjects()};row.append(check)}const del=document.createElement('button');del.className='chat-delete';del.textContent='×';del.setAttribute('aria-label',(lang==='es'?'Borrar ':'Delete ')+button.textContent);del.onclick=()=>deleteChats([chat.id],del);const original=button.onclick;button.onclick=()=>{original();};row.append(button,del);document.getElementById('history').append(row);;
}
let closeDeleteConfirmation = null;
function confirmChatDeletion(ids, anchor) {
  closeDeleteConfirmation?.();
  return new Promise(resolve => {
    const es = lang === 'es';
    const box = document.createElement('div');
    box.className = 'chat-delete-confirm';
    box.setAttribute('role','dialog');
    box.setAttribute('aria-label',es?'Confirmar borrado':'Confirm deletion');
    const message = document.createElement('p');
    message.textContent = es ? (ids.length===1?'¿Borrar este chat?':`¿Borrar ${ids.length} chats?`) : (ids.length===1?'Delete this chat?':`Delete ${ids.length} chats?`);
    const note = document.createElement('small');
    note.textContent = es?'Esta acción no se puede deshacer.':'This cannot be undone.';
    const actions = document.createElement('div');
    const cancel = document.createElement('button'); cancel.type='button'; cancel.textContent=es?'Cancelar':'Cancel';
    const remove = document.createElement('button'); remove.type='button'; remove.className='confirm-remove'; remove.textContent=es?'Borrar':'Delete';
    actions.append(cancel,remove); box.append(message,note,actions); document.body.append(box);
    const rect = anchor?.getBoundingClientRect() || {left:16,right:40,top:80,bottom:120};
    const width = box.getBoundingClientRect().width, height=box.getBoundingClientRect().height;
    box.style.left = Math.max(8,Math.min(rect.right+8,window.innerWidth-width-8))+'px';
    box.style.top = Math.max(8,Math.min(rect.top,window.innerHeight-height-8))+'px';
    let done=false;
    function finish(value){if(done)return;done=true;box.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);closeDeleteConfirmation=null;if(anchor?.isConnected)anchor.focus();resolve(value);}
    function dismiss(){finish(false);}
    function outside(e){if(!box.contains(e.target))finish(false);}
    function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel?remove:cancel).focus();}}
    cancel.onclick=()=>finish(false);remove.onclick=()=>finish(true);
    closeDeleteConfirmation=dismiss;
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
    cancel.focus();
  });
}
async function deleteChats(ids,anchor){if(!ids.length)return;if(!(await confirmChatDeletion(ids,anchor)))return;custom=custom.filter(c=>!ids.includes(c.id));hiddenChats=[...new Set([...hiddenChats,...ids])];ids.forEach(id=>delete assignments[id]);if(ids.includes(active))active=null;selectedChats.clear();persistProjects();save();render();}
const deleteConfirmStyle=document.createElement('style');deleteConfirmStyle.textContent=`
.chat-delete-confirm{position:fixed;z-index:1000;width:250px;max-width:calc(100vw - 16px);padding:16px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:16px;box-shadow:0 10px 36px #0004}
.chat-delete-confirm p{margin:0 0 6px;font-size:14px;font-weight:600}
.chat-delete-confirm small{color:var(--muted);font-size:12px}
.chat-delete-confirm>div{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.chat-delete-confirm button{min-height:40px;padding:8px 14px;border:1px solid var(--border);border-radius:10px;background:var(--side);color:var(--text)}
.chat-delete-confirm .confirm-remove{background:#b83b44;border-color:#b83b44;color:white}
`;document.head.append(deleteConfirmStyle);

function openProjectCreator(){
  const existing=document.getElementById('project-create-form');if(existing){existing.querySelector('input').focus();return;}
  const es=lang==='es',form=document.createElement('form');form.id='project-create-form';form.className='project-create-form';
  const label=document.createElement('label');label.textContent=es?'Nombre del proyecto':'Project name';
  const input=document.createElement('input');input.type='text';input.maxLength=80;input.required=true;input.autocomplete='off';input.placeholder=es?'Ej. Ideas de negocio':'e.g. Business ideas';label.append(input);
  const descriptionLabel=document.createElement('label');descriptionLabel.textContent=es?'¿Qué vas a hacer en este proyecto?':'What will you do in this project?';
  const description=document.createElement('textarea');description.rows=3;description.maxLength=1000;description.required=true;description.placeholder=es?'Describe tu objetivo: programación, edición de fotos, edición de video…':'Describe your goal: coding, photo editing, video editing…';descriptionLabel.append(description);
  const actions=document.createElement('div');const cancel=document.createElement('button');cancel.type='button';cancel.textContent=es?'Cancelar':'Cancel';
  const create=document.createElement('button');create.type='submit';create.className='project-create-submit';create.textContent=es?'Crear':'Create';create.disabled=true;
  const validate=()=>{create.disabled=!input.value.trim()||!description.value.trim();};input.oninput=description.oninput=validate;
  const close=()=>{form.remove();document.getElementById('project-add').setAttribute('aria-expanded','false');document.getElementById('project-add').focus();};
  cancel.onclick=close;form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
  form.onsubmit=e=>{e.preventDefault();const name=input.value.trim(),purpose=description.value.trim();if(!name||!purpose)return;projects.push({id:crypto.randomUUID(),name:Array.from(name).slice(0,80).join(''),description:Array.from(purpose).slice(0,1000).join('')});currentProject=projects[projects.length-1].id;active=null;close();persistProjects();render();};
  actions.append(cancel,create);form.append(label,descriptionLabel,actions);document.getElementById('project-list').before(form);document.getElementById('project-add').setAttribute('aria-expanded','true');input.focus();
}
const projectCreateStyle=document.createElement('style');projectCreateStyle.textContent=`
.project-create-form{padding:12px;margin:8px 0;background:var(--card);border:1px solid var(--border);border-radius:12px}
.project-create-form label{display:block;font-size:12px;color:var(--muted)}
.project-create-form input,.project-create-form textarea{display:block;box-sizing:border-box;width:100%;min-height:40px;margin-top:8px;padding:8px 10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font:inherit;font-size:14px}
.project-create-form label+label{margin-top:12px}.project-create-form textarea{resize:vertical;line-height:1.4}.project-description{font-size:12px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere;white-space:pre-wrap}
.project-create-form>div{display:flex;gap:8px;margin-top:10px}
.project-create-form button{flex:1;min-height:40px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--side);color:var(--text);font-size:12px}
.project-create-form .project-create-submit{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.project-create-form button:disabled{opacity:.45;cursor:default}
`;document.head.append(projectCreateStyle);
