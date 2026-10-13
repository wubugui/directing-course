/* No network calls, no automatic creative scoring. Old v2 storage is never overwritten. */
(function(){
'use strict';
const C=window.COURSE_REVIEW,root=document.getElementById('main');
if(!C||!Array.isArray(C.modules)||C.modules.length!==16){root.innerHTML='<h1>资料加载失败</h1><p>没有通过数据检查，课程未启动。请刷新后重试；旧学习记录未被改动。</p>';return;}
const KEY='directing-course-review-v3',OLD='directing-course-advanced-v2';
const ids=new Set(C.modules.map(x=>x.id));
const empty=()=>({version:3,plans:{},comparison:{},legacyNotes:{},importedV2:null});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mapCheck(x,name,fn){if(!obj(x))throw Error(name+' 必须是对象');for(const [k,v] of Object.entries(x)){if(!ids.has(k))throw Error(name+' 中包含未知课程 '+k);fn(v,k);}}
function textCheck(v){if(typeof v!=='string'||v.length>100000)throw Error('笔记必须是10万字符以内的文本');}
function validate(v){if(!obj(v)||v.version!==3)throw Error('版本不支持');const out=empty();
 mapCheck(v.plans,'plans',(x,k)=>{if(!obj(x))throw Error('方案格式错误');const p={A:'',B:''};for(const label of Object.keys(x)){if(!['A','B'].includes(label))throw Error('未知方案字段');textCheck(x[label]);p[label]=x[label];}out.plans[k]=p;});
 for(const f of ['comparison','legacyNotes']){mapCheck(v[f],f,(x,k)=>{textCheck(x);out[f][k]=x;});}if(v.importedV2!=null){if(typeof v.importedV2!=='string'||v.importedV2.length>2*1024*1024)throw Error('旧版归档过大或格式错误');out.importedV2=v.importedV2;}return out;
}
function validateLegacy(v){if(!obj(v))throw Error('旧记录格式错误');
 if(v.version!==undefined&&v.version!==2)throw Error('旧记录版本错误');
 const checkAxes=a=>{if(!Array.isArray(a)||a.length!==3||!a.every(n=>Number.isInteger(n)&&n>=0&&n<3))throw Error('旧记录选项越界');};
 mapCheck(v.axes??{},'axes',checkAxes);
 mapCheck(v.snapshots??{},'snapshots',(x)=>{if(!obj(x))throw Error('旧快照格式错误');for(const [k,s] of Object.entries(x)){if(!['A','B'].includes(k)||!obj(s))throw Error('旧快照格式错误');checkAxes(s.axes);}});
 mapCheck(v.visited??{},'visited',x=>{if(typeof x!=='boolean')throw Error('visited 格式错误');});
 const out=empty();mapCheck(v.notes??{},'notes',(x,k)=>{textCheck(x);out.legacyNotes[k]=x;});out.importedV2=JSON.stringify(v);return out;
}
let state=empty(),loadWarning='',legacyRaw=null;
try{legacyRaw=localStorage.getItem(OLD);const raw=localStorage.getItem(KEY);if(raw!==null)state=validate(JSON.parse(raw));else if(legacyRaw)state=validateLegacy(JSON.parse(legacyRaw));}
catch(e){loadWarning='已有记录未通过格式检查，已隔离；原始记录未覆盖。可用“导出记录”保留后检查。';}
let isolated=!!loadWarning,writingBlocked=false;
function notify(s){const e=document.getElementById('toast');e.textContent=s;e.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>e.hidden=true,6000);}
function save(){if(isolated){document.getElementById('status').textContent='异常原记录已保留；新输入仅在内存，请导出';return;}
 try{localStorage.setItem(KEY,JSON.stringify(state));writingBlocked=false;document.getElementById('status').textContent='已保存在本机；资料齐备不等于掌握技法';}
 catch(e){writingBlocked=true;document.getElementById('status').textContent='浏览器禁止保存；当前输入仅在内存，请导出';}}
function clean(s){return String(s||'').replace(/\s+/g,'').trim();}
function ready(id){const p=state.plans[id]||{};return !!(clean(p.A)&&clean(p.B)&&clean(p.A)!==clean(p.B)&&clean(state.comparison[id]));}
function current(){const match=location.hash.match(/^#lesson\/(\d{2})(?:\/(learn|cases|lab|quiz))?$/);return match?C.modules.find(m=>m.id===match[1]):null;}
function closeMenu(){document.getElementById('side').classList.remove('open');document.getElementById('shade').classList.remove('open');document.getElementById('menu').setAttribute('aria-expanded','false');}
function nav(){const q=document.getElementById('search').value.trim().toLowerCase(),m=current();const all=C.modules.filter(x=>(x.id+x.title+x.old+x.issue).toLowerCase().includes(q));document.getElementById('nav').innerHTML=all.length?all.map(x=>'<a href="#lesson/'+x.id+'" '+(m?.id===x.id?'aria-current="page"':'')+'><span class="number">'+x.id+'</span>　'+esc(x.title)+'</a>').join(''):'<p class="small muted">无匹配条目。</p>';}
function source(k){const s=C.sources[k];return '<div class="source"><a target="_blank" rel="noopener noreferrer" href="'+esc(s.url)+'">'+esc(s.title)+'</a><p class="small">定位：'+esc(s.section)+'</p><p class="small muted">支持范围：'+esc(s.scope)+'</p></div>';}
function footer(){return '<footer>review-20261013-r1 · 本版只主张下列具体勘误与注明范围的文献对照；不声称完成16节专业课程的全面学术或教学验收。旧源文件和原浏览器记录仍保留；其他项目仓库不受影响。</footer>';}
function home(){return '<span class="tag">纠错补丁 · 不是课程重新认证</span><h1>先纠正知识与交互，<br>再谈课程是否合格</h1><div class="warning"><strong>旧版不应被当成已核验的专业教材。</strong><p>本版停止默认展示未经核验的电影案例，撤下“27种／432种实验”和自动判定完成的宣传。16节逐项列出原说法、问题、修正范围与可定位来源。没有核过的部分明确保留为未核验，不用免责声明掩盖它。</p></div>'+
 (loadWarning?'<div class="card">'+esc(loadWarning)+'</div>':'')+
 '<div class="grid"><div class="card"><h2>文献支持到哪一句？</h2><p>每条来源有具体章节和支持范围。自拟练习、作品解读、理论分歧分别标注；引用一本书名不等于验证了一节课。</p></div><div class="card"><h2>交互实际做了什么？</h2><p>第04节逐拍展示信息顺序，第14节比较合流时保留／删除记忆的后果。其余页是勘误与手动改写记录，不伪装成自动剧情生成器。</p></div></div><h2>16节逐项勘误</h2>'+C.modules.map(m=>'<div class="card"><span class="tag">'+esc(m.level)+'</span><h3><a href="#lesson/'+m.id+'">'+m.id+' · '+esc(m.title)+'</a></h3><p>'+esc(m.issue)+'</p></div>').join('')+footer();}
function records(m){const p=state.plans[m.id]||{},n=state.legacyNotes[m.id];return '<section class="card"><h2>手动改写记录</h2><p class="notice">这是你的两份具体方案，不是自动生成结果。系统只检查是否填写、是否不同及是否有比较记录，不评价艺术质量。</p><div class="grid"><div><label for="planA">方案 A：动作、信息顺序与理由</label><textarea maxlength="100000" id="planA" data-field="A">'+esc(p.A||'')+'</textarea></div><div><label for="planB">方案 B：动作、信息顺序与理由</label><textarea maxlength="100000" id="planB" data-field="B">'+esc(p.B||'')+'</textarea></div></div><label for="comparison">比较记录：差异、适用范围、可能失败的情形</label><textarea maxlength="100000" id="comparison" data-field="comparison">'+esc(state.comparison[m.id]||'')+'</textarea><p id="readiness" role="status"></p>'+(n?'<details><summary>保留的旧版笔记（不计作新方案）</summary><p id="legacyNote">'+esc(n)+'</p></details>':'')+'</section>';}
function updateReady(){const m=current(),e=document.getElementById('readiness');if(!m||!e)return;const p=state.plans[m.id]||{};e.textContent=ready(m.id)?'资料已填写：两份不同的方案及比较记录。尚未评价创作质量。':clean(p.A)&&clean(p.A)===clean(p.B)?'A/B 内容相同，尚未形成两份不同方案。':'尚需两份不同方案及比较记录；这不是考试或能力评级。';}
let demo={mode:'early',step:0,history:'hurt',memory:'keep'};
const tracks={
 early:[{event:'先展示桥面下断开的支撑；角色在桥头，未看见桥下。',viewer:'知道桥的支撑已断。',actor:'尚不知道桥下状况。',question:'接下来重点可能是：他会不会踏上去？这里不是给紧张度打分。'},
 {event:'角色走近桥头，停下系鞋带，望向对岸。',viewer:'仍知道支撑已断，没有新增危险事实。',actor:'只看到表面完整的桥面。',question:'这一拍只有停顿，也可以比较自己的关注是否维持。不能用代码宣称每个人都会紧张。'},
 {event:'角色踏上木板，桥面下沉；他抓住栏杆。',viewer:'看到此前风险兑现。',actor:'此时才发现桥不稳。',question:'人物与观众的知识差正在缩小；世界中的事件没有因信息顺序而改变。'},
 {event:'角色退回岸边，回头看见断开的支撑。',viewer:'知道他退了回来。',actor:'知道桥面为什么下沉。',question:'比较你先前关心的是结果、过程还是解释；无需把感受强行填进唯一术语。'}],
 late:[{event:'先展示桥头的角色与表面完整的桥面，不展示桥下支撑。',viewer:'未被告知支撑的情况。',actor:'也只看到桥面。',question:'此时没有足够证据要求观众担忧这座桥；不要把作者知道的危险算进观众知识。'},
 {event:'角色停下系鞋带，望向对岸。',viewer:'仍未获得桥坏的证据。',actor:'仍未察觉危险。',question:'同一个停顿没有前置危险信息，可能有不同作用。时长并不能单独决定效果。'},
 {event:'角色踏上木板，桥面下沉；他抓住栏杆。',viewer:'与人物一起看到异常。',actor:'发现桥不稳。',question:'可能出现出乎预期的反应，但不能保证；观众也许早已从其他线索猜到了。'},
 {event:'角色退回岸边，回头看见断开的支撑。',viewer:'此时得到桥下沉的原因。',actor:'也看清断开的支撑。',question:'补上因果解释。想重看时，你已知结局；不要假装能清空第一次观看的记忆。'}]
};
function infoLab(){return '<section class="card" id="lab"><span class="tag">原创微场景 · 只改变信息发放</span><h2>逐拍演示：相同事故，两种揭示顺序</h2><p>固定事实：桥的支撑早已断开；角色踏上后下沉，随后退回岸边。只改变观众何时被告知支撑已断。演示只落实信息，不预测情绪，也不代表《寻狗记》设定。</p><label for="mode">选择展示顺序</label><select id="mode"><option value="early">事前给出桥坏的证据</option><option value="late">事后解释桥坏的原因</option></select><div id="infoFrame"></div><div class="row"><button id="prevBeat">上一拍</button><button id="nextBeat">下一拍</button><button id="resetBeat">从头观看</button></div><p class="notice">看过一种版本会改变对另一版的认识。这是对照阅读，不是盲测或随机实验。</p></section>';}
function drawInfo(){const e=document.getElementById('infoFrame');if(!e)return;const b=tracks[demo.mode][demo.step];e.innerHTML='<div class="timeline" aria-label="第'+(demo.step+1)+'拍，共4拍">'+tracks[demo.mode].map((_,i)=>'<span class="'+(i<=demo.step?'active':'')+'"></span>').join('')+'</div><p><strong>第 '+(demo.step+1)+' 拍：</strong>'+esc(b.event)+'</p><div class="ledger"><div><strong>观众获得的事实</strong>'+esc(b.viewer)+'</div><div><strong>角色此时所知</strong>'+esc(b.actor)+'</div><div><strong>需要比较的问题</strong>'+esc(b.question)+'</div></div>';document.getElementById('prevBeat').disabled=demo.step===0;document.getElementById('nextBeat').disabled=demo.step===3;document.getElementById('mode').value=demo.mode;}
function memoryLab(){return '<section class="card" id="lab"><span class="tag">明确规则的反事实演示 · 不是通用压缩算法</span><h2>合流时删掉一位记忆，会丢掉什么？</h2><p>原创微场景：两条来路都进入“雨天借伞”。本演示的作者规则：若来访者曾损坏并拒赔旧伞，店主先要求押金；否则直接借出。这里不把人物规则宣称为真实人类心理定律。</p><div class="row"><label for="history">此前经历</label><select id="history"><option value="hurt">曾损坏并拒赔</option><option value="clear">没有这件事</option></select><label for="memory">合流方式</label><select id="memory"><option value="keep">保留相关记忆</option><option value="drop">抹掉相关记忆</option></select></div><div id="memoryFrame"></div></section>';}
function drawMemory(){const e=document.getElementById('memoryFrame');if(!e)return;const hurt=demo.history==='hurt',kept=demo.memory==='keep',actual=hurt&&kept;e.innerHTML='<div class="ledger"><div><strong>固定公共场景</strong>雨天；同一家店；提出借伞。</div><div><strong>根据作者规则应回应</strong>'+(hurt?'“上次的还没赔，这回先留押金。”':'“拿去吧，记得送回来。”')+'</div><div><strong>当前合流方式实际回应</strong>'+(actual?'“上次的还没赔，这回先留押金。”':'“拿去吧，记得送回来。”')+'</div></div><p class="warning">'+(hurt&&!kept?'出现差异：本例后续回应确实依赖这段历史，直接抹掉该位违反了预先写定的规则。':'这组输入与预先写定的回应规则一致。它只检验当前借伞场景，不证明所有未来场景都等价。')+'</p>';document.getElementById('history').value=demo.history;document.getElementById('memory').value=demo.memory;}
function show(m){return '<span class="tag">'+esc(m.level)+'</span><h1>'+m.id+' · '+esc(m.title)+'</h1><div class="warning"><strong>本条是具体勘误，不是整节课程已通过认证。</strong><p>'+esc(m.boundary)+'</p></div><section class="card"><h2>原说法与问题</h2><p><strong>原稿：</strong>'+esc(m.old)+'</p><p><strong>问题：</strong>'+esc(m.issue)+'</p></section><section class="card"><h2>修正说明与适用范围</h2>'+m.text.map(t=>'<p>'+esc(t)+'</p>').join('')+'</section><section class="card"><h2>可定位来源及支持边界</h2>'+(m.refs.length?m.refs.map(source).join(''):'<p class="warning">本条为编辑层面的撤回／限定，尚无完成逐段核查的理论来源。不能把这些设计建议当作既定理论。</p>')+'</section>'+(m.id==='04'?infoLab():m.id==='14'?memoryLab():'')+records(m)+'<div class="row"><a class="button" href="#home">勘误总览</a>'+(m.id!=='01'?'<a class="button" href="#lesson/'+String(Number(m.id)-1).padStart(2,'0')+'">上一条</a>':'')+(m.id!=='16'?'<a class="button" href="#lesson/'+String(Number(m.id)+1).padStart(2,'0')+'">下一条</a>':'')+'</div>'+footer();}
function render(){const m=current(),hash=location.hash;root.innerHTML=m?show(m):(!hash||['#home','#main','#syllabus','#studio'].includes(hash)?home():'<h1>没有这条课程地址</h1><p><a href="#home">返回勘误总览</a></p>');nav();drawInfo();drawMemory();updateReady();closeMenu();}
document.getElementById('search').addEventListener('input',nav);
document.getElementById('menu').addEventListener('click',()=>{const open=!document.getElementById('side').classList.contains('open');document.getElementById('side').classList.toggle('open',open);document.getElementById('shade').classList.toggle('open',open);document.getElementById('menu').setAttribute('aria-expanded',String(open));});
document.getElementById('shade').addEventListener('click',closeMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
root.addEventListener('input',e=>{const f=e.target.dataset.field,m=current();if(!f||!m)return;if(f==='comparison')state.comparison[m.id]=e.target.value;else if(['A','B'].includes(f)){if(!state.plans[m.id])state.plans[m.id]={A:'',B:''};state.plans[m.id][f]=e.target.value;}save();updateReady();});
root.addEventListener('change',e=>{if(e.target.id==='mode'&&['early','late'].includes(e.target.value)){demo.mode=e.target.value;demo.step=0;drawInfo();}if(e.target.id==='history'&&['hurt','clear'].includes(e.target.value)){demo.history=e.target.value;drawMemory();}if(e.target.id==='memory'&&['keep','drop'].includes(e.target.value)){demo.memory=e.target.value;drawMemory();}});
root.addEventListener('click',e=>{if(e.target.id==='nextBeat')demo.step=Math.min(3,demo.step+1);else if(e.target.id==='prevBeat')demo.step=Math.max(0,demo.step-1);else if(e.target.id==='resetBeat')demo.step=0;else return;drawInfo();});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
function download(v,name){const url=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
document.getElementById('export').addEventListener('click',()=>{let archivedV2=legacyRaw,isolatedV3=null;try{archivedV2=localStorage.getItem(OLD);if(isolated)isolatedV3=localStorage.getItem(KEY);}catch(e){}download({schema:'dramaturgy-review-v3',release:C.release,progress:state,archivedV2,isolatedV3},'dramaturgy-review-progress.json');});
document.getElementById('import').addEventListener('click',()=>document.getElementById('file').click());
document.getElementById('file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw Error('文件超过2MiB');const input=JSON.parse(await file.text());if(!obj(input))throw Error('备份格式错误');let next;
 if(input.schema==='dramaturgy-review-v3')next=validate(input.progress);else if(input.schema==='dramaturgy-advanced-v2')next=validateLegacy(input.progress);else throw Error('不支持的备份版本');
 if(!window.confirm('导入会替换当前核查版记录；原v2记录不变。当前核查版会先尝试备份。继续？'))return;
 try{localStorage.setItem(KEY+'-before-import',localStorage.getItem(KEY)||JSON.stringify(state));}catch(e){throw Error('无法保存导入前备份，已取消导入；现有记录未改动');}
 // Commit only after all parsing, validation and backup succeed.
 state=next;isolated=false;loadWarning='';save();render();notify(writingBlocked?'导入到内存，但持久化失败，请立即导出':'已导入；原v2记录保留。新页中的资料齐备不等于掌握。');
 }catch(error){notify('导入失败：'+error.message+'。现有记录未改动。');}});
render();if(loadWarning)notify(loadWarning);
})();
