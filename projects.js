let projects=[],hiddenChats=[],assignments={},currentProject=null,currentSection=null,selecting=false,selectedChats=new Set();
try{projects=JSON.parse(localStorage.getItem('nuna-projects')||'[]');hiddenChats=JSON.parse(localStorage.getItem('nuna-hidden')||'[]');assignments=JSON.parse(localStorage.getItem('nuna-assignments')||'{}')}catch{}
function persistProjects(){try{localStorage.setItem('nuna-projects',JSON.stringify(projects));localStorage.setItem('nuna-hidden',JSON.stringify(hiddenChats));localStorage.setItem('nuna-assignments',JSON.stringify(assignments))}catch{}}
const projectSection=document.createElement('section');projectSection.className='project-section';projectSection.innerHTML='<div class="project-heading"><span id="projects-label"></span><button class="project-add" id="project-add">＋</button></div><div id="project-list"></div><div class="sidebar-tools" hidden><button id="select-chats"></button><button id="delete-selected" hidden></button></div><div class="project-toolbar" id="project-assignment"></div>';document.querySelector('.history-label').before(projectSection);
const expandedProjects=new Set(),expandedSections=new Set();
const projectChatContainers=new Map(),sectionChatContainers=new Map();
function refreshProjects(){
 const es=lang==='es',add=document.getElementById('project-add');document.getElementById('projects-label').textContent=es?'PROYECTOS':'PROJECTS';add.setAttribute('aria-label',es?'Crear proyecto':'Create project');add.onclick=openProjectCreator;
 const list=document.getElementById('project-list');list.replaceChildren();
 projectChatContainers.clear();sectionChatContainers.clear();
 const project=projects.find(p=>p.id===currentProject);if(!project)currentSection=null;
 projects.forEach(p=>{
  const branch=document.createElement('div');branch.className='project-branch';
  const button=document.createElement('button');button.className='project-tree-toggle';button.textContent=(expandedProjects.has(p.id)?'▾ ':'▸ ')+p.name;button.setAttribute('aria-expanded',String(expandedProjects.has(p.id)));button.classList.toggle('active',currentProject===p.id);
  button.onclick=()=>{currentProject=p.id;currentSection=null;if(expandedProjects.has(p.id))expandedProjects.delete(p.id);else expandedProjects.add(p.id);render()};const heading=document.createElement('div');heading.className='project-tree-heading';const removeProject=document.createElement('button');removeProject.className='project-delete';removeProject.textContent='⋯';removeProject.setAttribute('aria-label',(es?'Opciones del proyecto ':'Project options for ')+p.name);removeProject.setAttribute('aria-haspopup','dialog');removeProject.setAttribute('aria-expanded','false');removeProject.onclick=()=>openProjectActions(p,removeProject);const compose=document.createElement('button');compose.className='project-compose';compose.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="13"/><path d="M7 16C13 9 20 9 25 21M7 16C13 23 20 23 25 11"/></svg>';compose.setAttribute('aria-label',(es?'Nuevo chat en ':'New chat in ')+p.name);compose.title=es?'Nuevo chat':'New chat';compose.onclick=()=>{currentProject=p.id;currentSection=null;expandedProjects.add(p.id);document.getElementById('new-chat').click();};heading.append(button,compose,removeProject);branch.append(heading);
  if(expandedProjects.has(p.id)){
   const children=document.createElement('div');children.className='project-tree-children';
   const direct=document.createElement('div');direct.className='project-direct-chats';projectChatContainers.set(p.id,direct);children.append(direct);
   (p.sections||[]).forEach(section=>{
    const group=document.createElement('div');group.className='section-branch';const key=p.id+':'+section.id;
    const toggle=document.createElement('button');toggle.className='section-tree-toggle';toggle.textContent=(expandedSections.has(key)?'▾ ':'▸ ')+section.name;toggle.setAttribute('aria-expanded',String(expandedSections.has(key)));toggle.classList.toggle('active',currentProject===p.id&&currentSection===section.id);
    toggle.onclick=()=>{currentProject=p.id;currentSection=section.id;if(expandedSections.has(key))expandedSections.delete(key);else expandedSections.add(key);render()};group.append(toggle);
    if(expandedSections.has(key)){const chats=document.createElement('div');chats.className='section-chat-list';sectionChatContainers.set(key,chats);group.append(chats);const newChat=document.createElement('button');newChat.className='tree-new-chat';newChat.textContent=es?'＋ Nuevo chat':'＋ New chat';newChat.onclick=()=>{currentProject=p.id;currentSection=section.id;document.getElementById('new-chat').click()};group.append(newChat)}children.append(group);
   });
   branch.append(children);
  }list.append(branch);
 });
 const select=document.getElementById('select-chats');select.textContent=selecting?(es?'Cancelar selección':'Cancel selection'):(es?'Seleccionar chats':'Select chats');select.onclick=()=>{selecting=!selecting;selectedChats.clear();render()};
 const del=document.getElementById('delete-selected');del.hidden=!selecting;del.disabled=!selectedChats.size;del.textContent=(es?'Borrar':'Delete')+' ('+selectedChats.size+')';del.onclick=()=>deleteChats([...selectedChats],del);
 const area=document.getElementById('project-assignment');area.replaceChildren();
 if(project?.description){const details=document.createElement('p');details.className='project-description';details.textContent=project.description;area.append(details)}

}
function openSectionCreator(project,container){
 if(container.querySelector('form'))return;
 const es=lang==='es',form=document.createElement('form');form.className='project-create-form';const label=document.createElement('label');label.textContent=es?'Nombre de la sección':'Section name';const input=document.createElement('input');input.required=true;input.maxLength=80;label.append(input);
 const actions=document.createElement('div'),cancel=document.createElement('button'),create=document.createElement('button');cancel.type='button';cancel.textContent=es?'Cancelar':'Cancel';create.type='submit';create.textContent=es?'Crear':'Create';create.disabled=true;input.oninput=()=>create.disabled=!input.value.trim();cancel.onclick=()=>form.remove();form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();form.remove();}};
 form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;const section={id:crypto.randomUUID(),name:Array.from(input.value.trim()).slice(0,80).join('')};project.sections=[...(project.sections||[]),section];currentSection=section.id;expandedProjects.add(project.id);expandedSections.add(project.id+':'+section.id);active=null;persistProjects();render();};actions.append(cancel,create);form.append(label,actions);container.append(form);input.focus();
}
function decorateChat(button,chat){
 if(hiddenChats.includes(chat.id))return;
 const projectId=assignments[chat.id]??chat.project,project=projects.find(p=>p.id===projectId),sectionId=assignments['section:'+chat.id]||null;
 let target=document.getElementById('history');
 if(project){if(!expandedProjects.has(project.id))return;const section=(project.sections||[]).find(s=>s.id===sectionId);target=section?sectionChatContainers.get(project.id+':'+section.id):projectChatContainers.get(project.id);if(!target)return;}
 const row=document.createElement('div');row.className='history-row';
 if(selecting){const check=document.createElement('input');check.type='checkbox';check.checked=selectedChats.has(chat.id);check.setAttribute('aria-label',(lang==='es'?'Seleccionar ':'Select ')+button.textContent);check.onchange=()=>{if(check.checked)selectedChats.add(chat.id);else selectedChats.delete(chat.id);render()};row.append(check)}
 const del=document.createElement('button');del.className='chat-delete chat-more';del.textContent='⋯';del.setAttribute('aria-label',(lang==='es'?'Opciones de ':'Options for ')+button.textContent);del.setAttribute('aria-haspopup','dialog');del.setAttribute('aria-expanded','false');del.onclick=()=>openChatActions(chat,del);
 const original=button.onclick;button.onclick=()=>{currentProject=project?.id||null;currentSection=sectionId;original();};row.append(button,del);target.append(row);
}
let closeDeleteConfirmation = null;
function confirmChatDeletion(ids, anchor, options = {}) {
  closeDeleteConfirmation?.();
  return new Promise(resolve => {
    const es = lang === 'es';
    const box = document.createElement('div');
    box.className = 'chat-delete-confirm';
    box.setAttribute('role','dialog');
    box.setAttribute('aria-label',es?'Confirmar borrado':'Confirm deletion');
    const message = document.createElement('p');
    message.textContent = options.message || (es ? (ids.length===1?'¿Borrar este chat?':`¿Borrar ${ids.length} chats?`) : (ids.length===1?'Delete this chat?':`Delete ${ids.length} chats?`));
    const note = document.createElement('small');
    note.textContent = options.note || (es?'Esta acción no se puede deshacer.':'This cannot be undone.');
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
async function deleteChats(ids,anchor){if(!ids.length)return;if(!(await confirmChatDeletion(ids,anchor)))return;custom=custom.filter(c=>!ids.includes(c.id));hiddenChats=[...new Set([...hiddenChats,...ids])];ids.forEach(id=>{delete assignments[id];delete assignments['section:'+id]});if(ids.includes(active))active=null;selectedChats.clear();persistProjects();save();render();}
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
  const taskGroup=document.createElement('fieldset');taskGroup.className='project-task-options';
  const legend=document.createElement('legend');legend.textContent=es?'¿Con qué vas a trabajar?':'What will you work on?';taskGroup.append(legend);
  const selectedTasks=new Set();
  const taskOptions=[['code',es?'Código':'Code','⌘'],['images',es?'Imágenes':'Images','▧'],['video',es?'Video':'Video','▷'],['chat',es?'Chat':'Chat','☷']];
  taskOptions.forEach(([id,name,icon])=>{const option=document.createElement('button');option.type='button';option.textContent=icon+' '+name;option.setAttribute('aria-pressed','false');option.onclick=()=>{if(selectedTasks.has(id))selectedTasks.delete(id);else selectedTasks.add(id);option.setAttribute('aria-pressed',String(selectedTasks.has(id)));validate();};taskGroup.append(option)});
  const descriptionLabel=document.createElement('label');descriptionLabel.textContent=es?'Describe tu objetivo':'Describe your goal';
  const description=document.createElement('textarea');description.rows=3;description.maxLength=1000;description.required=true;description.placeholder=es?'Describe tu objetivo: programación, edición de fotos, edición de video…':'Describe your goal: coding, photo editing, video editing…';descriptionLabel.append(description);
  const actions=document.createElement('div');const cancel=document.createElement('button');cancel.type='button';cancel.textContent=es?'Cancelar':'Cancel';
  const create=document.createElement('button');create.type='submit';create.className='project-create-submit';create.textContent=es?'Crear':'Create';create.disabled=true;
  const validate=()=>{create.disabled=!input.value.trim()||!selectedTasks.size;};input.oninput=description.oninput=validate;
  const close=()=>{form.remove();document.getElementById('project-add').setAttribute('aria-expanded','false');document.getElementById('project-add').focus();};
  cancel.onclick=close;form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
  form.onsubmit=e=>{e.preventDefault();const name=input.value.trim(),purpose=description.value.trim();if(!name||!selectedTasks.size)return;projects.push({id:crypto.randomUUID(),name:Array.from(name).slice(0,80).join(''),description:Array.from(purpose).slice(0,1000).join(''),tasks:[...selectedTasks]});currentProject=projects[projects.length-1].id;expandedProjects.add(currentProject);currentSection=null;active=null;close();persistProjects();render();};
  actions.append(cancel,create);form.append(label,taskGroup,actions);document.getElementById('project-list').before(form);document.getElementById('project-add').setAttribute('aria-expanded','true');input.focus();
}
const projectCreateStyle=document.createElement('style');projectCreateStyle.textContent=`
.project-create-form{padding:12px;margin:8px 0;background:var(--card);border:1px solid var(--border);border-radius:12px}
.project-create-form label{display:block;font-size:12px;color:var(--muted)}
.project-create-form input,.project-create-form textarea,.project-create-form select{display:block;box-sizing:border-box;width:100%;min-height:40px;margin-top:8px;padding:8px 10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;font:inherit;font-size:14px}
.project-create-form label+label{margin-top:12px}.project-create-form textarea{resize:vertical;line-height:1.4}.project-description{font-size:12px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere;white-space:pre-wrap}
.project-create-form>div{display:flex;gap:8px;margin-top:10px}
.project-create-form button{flex:1;min-height:40px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--side);color:var(--text);font-size:12px}
.project-create-form .project-create-submit{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.project-create-form button:disabled{opacity:.45;cursor:default}
`;document.head.append(projectCreateStyle);

function projectContextForChat(chat){const p=projects.find(p=>p.id===(chat?.project||currentProject));return p?{name:String(p.name||'').slice(0,80),description:((Array.isArray(p.tasks)&&p.tasks.length?'Project work types: '+p.tasks.join(', ')+'.\n':'')+String(p.description||'')).slice(0,1000)}:null;}

function assignNewChatSection(chat){if(currentProject&&currentSection&&currentSection!=='@direct'){assignments['section:'+chat.id]=currentSection;persistProjects();}}
const sectionsStyle=document.createElement('style');sectionsStyle.textContent='.project-sections{margin:6px 0 12px 12px;padding-left:10px;border-left:1px solid var(--border)}.project-sections>button{font-size:12px!important;min-height:36px}.project-description{max-height:120px;overflow:auto}';document.head.append(sectionsStyle);

const treeStyle=document.createElement('style');treeStyle.textContent=`
.project-tree-children{margin:3px 0 10px 10px;padding-left:8px;border-left:1px solid var(--border)}
.section-chat-list{margin-left:8px;padding-left:6px;border-left:1px solid var(--border)}
.project-tree-children .history-row>button:first-of-type{font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.project-tree-toggle,.section-tree-toggle{text-align:left!important;width:100%;font-weight:550}
.project-tree-children .tree-new-chat,.project-tree-children .tree-new-section{font-size:11px!important;min-height:34px;color:var(--muted)}
.section-branch>.section-tree-toggle{font-size:12px!important}
`;document.head.append(treeStyle);

async function deleteProject(project,anchor){
 const es=lang==='es';const confirmed=await confirmChatDeletion([],anchor,{message:es?`¿Borrar el proyecto «${project.name}»?`:`Delete project “${project.name}”?`,note:es?'Se borran el proyecto y sus secciones. Los chats se conservarán sin proyecto.':'The project and its sections are removed. Chats are kept outside the project.'});if(!confirmed)return;
 const ids=new Set(custom.filter(c=>(assignments[c.id]??c.project)===project.id).map(c=>c.id));Object.keys(assignments).forEach(id=>{if(assignments[id]===project.id)ids.add(id)});
 ids.forEach(id=>{assignments[id]='';assignments['section:'+id]='';const chat=custom.find(c=>c.id===id);if(chat)chat.project=null;});projects=projects.filter(p=>p.id!==project.id);hiddenChats=[...new Set([...hiddenChats,'project:'+project.id])];expandedProjects.delete(project.id);if(currentProject===project.id){currentProject=null;currentSection=null;}persistProjects();save();render();
}
const projectDeleteStyle=document.createElement('style');projectDeleteStyle.textContent='.project-tree-heading{display:flex;align-items:center;gap:4px}.project-tree-heading .project-tree-toggle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-tree-heading .project-delete{width:32px;min-height:32px;flex-shrink:0;padding:0;border:0;background:transparent;color:var(--muted)}.project-tree-heading .project-delete:hover{color:#e5484d}';document.head.append(projectDeleteStyle);

const taskStyle=document.createElement('style');taskStyle.textContent=`
.project-task-options{border:0;padding:0;margin:14px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.project-task-options legend{font-size:12px;color:var(--muted);margin-bottom:8px}
.project-task-options button{display:block;font-size:12px;min-height:42px;border:1px solid var(--border);background:var(--side);color:var(--text);border-radius:10px;padding:8px}
.project-task-options button[aria-pressed=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--card));color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
`;document.head.append(taskStyle);

const bulkHideStyle=document.createElement('style');bulkHideStyle.textContent='.sidebar-tools[hidden]{display:none!important}';document.head.append(bulkHideStyle);

let closeChatActions=null;
function openChatActions(chat,anchor){
 if(closeChatActions){const same=anchor.getAttribute('aria-expanded')==='true';closeChatActions();if(same)return;}
 const es=lang==='es',box=document.createElement('div');box.className='chat-actions-menu';box.setAttribute('role','dialog');box.setAttribute('aria-label',es?'Opciones del chat':'Chat options');document.body.append(box);anchor.setAttribute('aria-expanded','true');
 function position(){const r=anchor.getBoundingClientRect(),b=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(r.right+6,innerWidth-b.width-8))+'px';box.style.top=Math.max(8,Math.min(r.top,innerHeight-b.height-8))+'px';}
 function close(){box.remove();anchor.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);closeChatActions=null;if(anchor.isConnected)anchor.focus();}
 function outside(e){if(!box.contains(e.target)&&!anchor.contains(e.target))close();}
 function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}
 function action(text,fn,danger=false){const b=document.createElement('button');b.type='button';b.textContent=text;if(danger)b.className='danger';b.onclick=fn;box.append(b);return b;}
 function move(project,section=null){assignments[chat.id]=project?.id||'';assignments['section:'+chat.id]=section?.id||'';const stored=custom.find(c=>c.id===chat.id);if(stored)stored.project=project?.id||null;if(project){expandedProjects.add(project.id);if(section)expandedSections.add(project.id+':'+section.id);}close();persistProjects();save();render();}
 function showProjects(){box.replaceChildren();const title=document.createElement('strong');title.textContent=es?'Añadir a proyecto':'Add to project';box.append(title);
  if(!projects.length){const note=document.createElement('p');note.textContent=es?'Primero crea un proyecto con el botón +.':'Create a project with the + button first.';box.append(note);}
  projects.forEach(project=>action(project.name,()=>{if(!project.sections?.length){move(project);return;}box.replaceChildren();const label=document.createElement('strong');label.textContent=project.name;box.append(label);action(es?'Guardar directamente en el proyecto':'Save directly in project',()=>move(project));project.sections.forEach(section=>action('▱ '+section.name,()=>move(project,section)));action(es?'← Volver':'← Back',showProjects);position();box.querySelector('button')?.focus();}));
  if(assignments[chat.id]||chat.project)action(es?'Quitar del proyecto':'Remove from project',()=>move(null));action(es?'Cancelar':'Cancel',close);position();box.querySelector('button')?.focus();
 }
 action(es?'Añadir a proyecto':'Add to project',showProjects);action(es?'Borrar':'Delete',()=>{close();deleteChats([chat.id],anchor);},true);position();box.querySelector('button').focus();
 closeChatActions=close;document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
}
const chatActionsStyle=document.createElement('style');chatActionsStyle.textContent=`
.chat-actions-menu{position:fixed;z-index:1000;width:230px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:6px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 28px #0004}
.chat-actions-menu button{display:block;width:100%;min-height:40px;text-align:left;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:var(--text);font-size:13px;overflow-wrap:anywhere}
.chat-actions-menu button:hover{background:var(--hover)}.chat-actions-menu .danger{color:#e5484d}
.chat-actions-menu strong,.chat-actions-menu p{display:block;padding:8px 12px;margin:0;font-size:12px;line-height:1.4}
.chat-more{font-size:22px!important;line-height:1}.chat-more[aria-expanded=true]{opacity:1!important;background:var(--hover)!important}
`;document.head.append(chatActionsStyle);
const projectLayoutFix=document.createElement('style');projectLayoutFix.textContent=`
#project-list{max-height:45dvh;overflow-y:auto;overflow-x:hidden;min-width:0}
#project-list .project-branch,#project-list .project-tree-children,#project-list .section-branch{min-width:0;max-width:100%;box-sizing:border-box}
#project-list .project-tree-heading{display:flex;align-items:center;width:100%;min-width:0;gap:2px}
#project-list .project-tree-heading .project-tree-toggle{width:auto;flex:1 1 0;min-width:0;padding:10px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#project-list .project-tree-heading .project-delete{width:32px;flex:0 0 32px;min-width:32px;padding:0;min-height:36px;text-align:center}
#project-list .history-row{width:100%;min-width:0}
#project-list .history-row .chat-more{width:28px;flex:0 0 28px;padding:4px;text-align:center}
#project-list .history-row>button:first-of-type{width:auto;flex:1 1 0;min-width:0}
#project-list .section-tree-toggle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;document.head.append(projectLayoutFix);

let closeProjectActions=null;
function openProjectActions(project,anchor){
 if(closeProjectActions){const same=anchor.getAttribute('aria-expanded')==='true';closeProjectActions();if(same)return;}
 closeChatActions?.();const es=lang==='es',box=document.createElement('div');box.className='chat-actions-menu';box.setAttribute('role','dialog');box.setAttribute('aria-label',es?'Opciones del proyecto':'Project options');document.body.append(box);anchor.setAttribute('aria-expanded','true');
 function position(){const r=anchor.getBoundingClientRect(),b=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(r.right+6,innerWidth-b.width-8))+'px';box.style.top=Math.max(8,Math.min(r.top,innerHeight-b.height-8))+'px';}
 function close(){box.remove();anchor.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);closeProjectActions=null;if(anchor.isConnected)anchor.focus();}
 function outside(e){if(!box.contains(e.target)&&!anchor.contains(e.target))close();}
 function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}
 const edit=document.createElement('button');edit.type='button';edit.textContent=es?'Editar nombre':'Edit name';edit.onclick=()=>{
  box.replaceChildren();const form=document.createElement('form');form.className='project-rename-form';const label=document.createElement('label');label.textContent=es?'Nombre del proyecto':'Project name';const input=document.createElement('input');input.type='text';input.maxLength=80;input.required=true;input.value=project.name;label.append(input);
  const actions=document.createElement('div'),cancel=document.createElement('button'),saveName=document.createElement('button');cancel.type='button';cancel.textContent=es?'Cancelar':'Cancel';cancel.onclick=close;saveName.type='submit';saveName.textContent=es?'Guardar':'Save';input.oninput=()=>saveName.disabled=!input.value.trim();
  form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;project.name=Array.from(input.value.trim()).slice(0,80).join('');project.updatedAt=new Date().toISOString();close();persistProjects();render();};actions.append(cancel,saveName);form.append(label,actions);box.append(form);position();input.focus();input.select();
 };
 const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent=es?'Borrar':'Delete';remove.onclick=()=>{close();deleteProject(project,anchor);};const newChat=document.createElement('button');newChat.textContent=es?'Nuevo chat':'New chat';newChat.onclick=()=>{close();currentProject=project.id;currentSection=null;expandedProjects.add(project.id);document.getElementById('new-chat').click();};const newSection=document.createElement('button');newSection.textContent=es?'Nueva sección':'New section';newSection.onclick=()=>{close();currentProject=project.id;expandedProjects.add(project.id);render();openSectionCreator(project,projectChatContainers.get(project.id).parentElement);};box.append(edit,newSection);position();edit.focus();closeProjectActions=close;
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
}
const renameStyle=document.createElement('style');renameStyle.textContent=`
#project-list .project-tree-heading .project-delete{font-size:22px}
#project-list .project-tree-heading .project-compose{width:30px;flex:0 0 30px;min-width:30px;padding:0;min-height:36px;text-align:center;font-size:22px;background:transparent;color:var(--accent);border:0;display:grid;place-items:center}
.project-rename-form{padding:10px}.project-rename-form label{font-size:12px;color:var(--muted)}
.project-rename-form input{box-sizing:border-box;width:100%;margin:8px 0 10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font:inherit;font-size:14px}
.project-rename-form>div{display:flex;gap:6px}.project-rename-form button{width:auto;flex:1;text-align:center;border:1px solid var(--border)}
`;document.head.append(renameStyle);
