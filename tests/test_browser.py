"""Chromium DOM/event tests. Navigation is unavailable in this environment.
The real HTML/CSS/JS are injected with set_content. Storage and download are shims;
these are NOT live-site, resource-loading, filesystem-persistence or network tests.
"""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'evidence';OUT.mkdir(exist_ok=True)
html=(BASE/'index.html').read_text()
html=html.replace('<script src="./review-data.js?v=review-20261013-r1"></script>','<script>'+(BASE/'review-data.js').read_text()+'</script>')
html=html.replace('<script src="./review-app.js?v=review-20261013-r1"></script>','<script>'+(BASE/'review-app.js').read_text()+'</script>')
results=[];errors=[]
def check(name,value,detail=''):
 results.append({'test':name,'passed':bool(value),'detail':detail})
 if not value: print('FAIL',name,detail)
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']}
 exe=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
 if exe:opts['executable_path']=exe
 b=p.chromium.launch(**opts);context=b.new_context(viewport={'width':1440,'height':1000})
 def mount(store=None,blocked=False,missing=False):
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
  page.evaluate('''arg=>{window.__store={...arg.store};Object.defineProperty(window,'localStorage',{value:{getItem(k){return Object.hasOwn(__store,k)?__store[k]:null},setItem(k,v){if(arg.blocked)throw Error('blocked');__store[k]=String(v)},removeItem(k){delete __store[k]}}});const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__exportBlob=blob;return original.call(this,blob)};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)click.call(this)};}''',{'store':store or {},'blocked':blocked})
  content=html
  if missing: content=content.replace('<script>'+(BASE/'review-data.js').read_text()+'</script>','')
  page.set_content(content,wait_until='load');return page
 def go(page,h):page.evaluate('(h)=>location.hash=h',h);page.wait_for_timeout(35)
 def upload(page,x,raw=False):
  page.locator('#file').set_input_files({'name':'test.json','mimeType':'application/json','buffer':x.encode() if raw else json.dumps(x,ensure_ascii=False).encode()});page.wait_for_timeout(80)
 page=mount()
 check('16_navigation_items',page.locator('#nav a').count()==16)
 for i in range(1,17):
  go(page,f'#lesson/{i:02d}');check(f'route_{i:02d}',page.locator('h1').inner_text().startswith(f'{i:02d}'))
 check('source_scope_visible',page.locator('main').inner_text().find('尚无完成逐段核查的理论来源')>=0)
 go(page,'#lesson/04');page.locator('#mode').focus();page.locator('#mode').select_option('late')
 check('selection_keeps_focus',page.evaluate('document.activeElement.id')=='mode')
 check('actual_beat_changes','不展示桥下支撑' in page.locator('#infoFrame').inner_text())
 for _ in range(3):page.locator('#nextBeat').click()
 check('timeline_bounds',page.locator('#nextBeat').is_disabled())
 page.locator('#resetBeat').click();check('timeline_reset',page.locator('#prevBeat').is_disabled())
 page.locator('#mode').select_option('early');page.locator('#nextBeat').click()
 check('constant_evidence_not_called_failure','没有新增危险事实' in page.locator('#infoFrame').inner_text())
 page.locator('#planA').fill('A：先给证据。');page.locator('#planB').fill('B：后给证据。');page.locator('#comparison').fill('比较信息顺序，而不声称情绪保证。')
 check('live_readiness','资料已填写' in page.locator('#readiness').inner_text())
 page.locator('#planB').fill('A：先给证据。');check('same_plan_rejected','内容相同' in page.locator('#readiness').inner_text())
 page.locator('#planB').fill('A： 先给 证据。');check('whitespace_difference_rejected','内容相同' in page.locator('#readiness').inner_text())
 payload='<img src=x onerror="window.BAD=true">';page.locator('#planB').fill(payload)
 storage=page.evaluate('window.__store');page.close();page=mount(storage);go(page,'#lesson/04')
 check('serialization_reload_with_storage_shim',page.locator('#planB').input_value()==payload)
 check('stored_html_not_executed',page.evaluate('window.BAD') is None and page.locator('img').count()==0)
 page.locator('#export').click();exported=json.loads(page.evaluate('window.__exportBlob.text()'))
 check('export_serialization',exported['progress']['plans']['04']['B']==payload,'Blob serialized; actual file download intentionally intercepted.')
 before=page.evaluate('localStorage.getItem("directing-course-review-v3")')
 upload(page,{'schema':'dramaturgy-advanced-v2','progress':{'version':2,'axes':{'01':[99,1,1]},'snapshots':{},'notes':{}}})
 check('out_of_range_import_atomic','导入失败' in page.locator('#toast').inner_text() and page.evaluate('localStorage.getItem("directing-course-review-v3")')==before)
 upload(page,{'schema':'dramaturgy-review-v3','progress':{'version':3,'plans':{'04':{'A':{}}},'comparison':{},'legacyNotes':{}}})
 check('wrong_type_import_atomic',page.evaluate('localStorage.getItem("directing-course-review-v3")')==before)
 upload(page,'{',True);check('malformed_json_atomic',page.evaluate('localStorage.getItem("directing-course-review-v3")')==before)
 upload(page,' '*(2*1024*1024+1),True);check('oversize_rejected','超过2MiB' in page.locator('#toast').inner_text())
 legacy={'schema':'dramaturgy-advanced-v2','progress':{'version':2,'axes':{'01':[1,1,1]},'snapshots':{'01':{'A':{'axes':[1,1,1]},'B':{'axes':[2,1,1]}}},'notes':{'01':'旧笔记'}}}
 oldraw=json.dumps(legacy['progress'],ensure_ascii=False);page.evaluate('x=>localStorage.setItem("directing-course-advanced-v2",x)',oldraw)
 upload(page,legacy);go(page,'#lesson/01')
 check('old_import_missing_visited_safe',page.locator('#legacyNote').text_content()=='旧笔记')
 check('old_storage_not_changed',page.evaluate('localStorage.getItem("directing-course-advanced-v2")')==oldraw)
 check('imported_v2_snapshots_archived',json.loads(json.loads(page.evaluate('localStorage.getItem("directing-course-review-v3")'))['importedV2'])['snapshots']==legacy['progress']['snapshots'])
 check('preimport_backup',page.evaluate('!!localStorage.getItem("directing-course-review-v3-before-import")'))
 upload(page,exported);go(page,'#lesson/04');check('import_export_text_roundtrip',page.locator('#planB').input_value()==payload)
 go(page,'#lesson/14');page.locator('#memory').focus();page.locator('#memory').select_option('drop')
 check('memory_counterexample','出现差异' in page.locator('#memoryFrame').inner_text())
 check('memory_select_keeps_focus',page.evaluate('document.activeElement.id')=='memory')
 page.locator('#history').select_option('clear');check('memory_matching_case','这组输入' in page.locator('#memoryFrame').inner_text())
 go(page,'#lesson/04/lab');check('legacy_hash_supported',page.locator('h1').inner_text().startswith('04'))
 go(page,'#lesson/99');check('unknown_hash_has_recovery',page.locator('h1').inner_text()=='没有这条课程地址')
 go(page,'#lesson/04');page.locator('#toast').evaluate('(e)=>e.hidden=true');page.wait_for_timeout(250);page.screenshot(path=str(OUT/'desktop-review.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});go(page,'#home');check('mobile_no_overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.locator('#menu').click();check('mobile_menu_opens',page.locator('#menu').get_attribute('aria-expanded')=='true')
 page.locator('#search').fill('04');page.locator('#nav a').click();page.wait_for_timeout(40)
 check('mobile_navigation_closes_menu',page.locator('#menu').get_attribute('aria-expanded')=='false')
 check('mobile_lesson_no_overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.wait_for_timeout(250);page.screenshot(path=str(OUT/'mobile-review.png'),full_page=True)
 broken=mount({'directing-course-review-v3':'{bad'});check('bad_storage_quarantined','已隔离' in broken.locator('#toast').inner_text())
 go(broken,'#lesson/01');broken.locator('#planA').fill('新输入')
 check('bad_original_not_overwritten',broken.evaluate('localStorage.getItem("directing-course-review-v3")')=='{bad')
 blocked=mount(blocked=True);go(blocked,'#lesson/01');blocked.locator('#planA').fill('内存')
 check('storage_error_visible','仅在内存' in blocked.locator('#status').inner_text())
 missing=mount(missing=True);check('missing_data_fails_closed',missing.locator('h1').inner_text()=='资料加载失败')
 check('no_uncaught_exceptions',not errors,str(errors))
 # Legacy expressions and a minimal equivalent DOM pattern from main@2bb246f4.
 # Isolated reproductions, not a full replay of the old website.
 legacy_page=context.new_page();legacy_page.set_content('<main id="app"></main>')
 old=legacy_page.evaluate('''()=>{const results={};let P={snapshots:{'01':{A:{axes:[1,1,1]},B:{axes:[1,1,1]}}},notes:{'01':'x'}};function done(id){var s=P.snapshots[id]||{};return !!(s.A&&s.B&&String(P.notes[id]||'').trim())}results.identical_marked_done=done('01');const d={axes:[{choices:[['a'],['b'],['c']]}]};try{d.axes[0].choices[99][0]}catch(e){results.bad_index=e.name}P={axes:{},notes:{},snapshots:{}};try{P.visited['01']=true}catch(e){results.missing_visited=e.name}const app=document.getElementById('app');function render(){app.innerHTML='<select id="s"><option>one</option><option>two</option></select>'}render();document.getElementById('s').focus();render();results.focus_lost=document.activeElement.id!=='s';return results}''')
 check('legacy_identical_AB_bug_reproduced',old['identical_marked_done'])
 check('legacy_bad_index_crash_reproduced',old['bad_index']=='TypeError')
 check('legacy_missing_visited_crash_reproduced',old['missing_visited']=='TypeError')
 check('legacy_rerender_focus_loss_reproduced',old['focus_lost'])
 (OUT/'legacy-reproduction.json').write_text(json.dumps({'source':'main@2bb246f4e305129ff809a9f571c2668d307e269a','scope':'Isolated function/DOM reproductions, not a complete replay of the old website','results':old},ensure_ascii=False,indent=2))
 b.close()
(OUT/'browser-results.json').write_text(json.dumps({'browser':'Chromium via Playwright','scope':'HTML/CSS/JS rendered in Chromium using set_content; storage/download are shims; no real navigation or public-site E2E','results':results},ensure_ascii=False,indent=2))
print(json.dumps({'passed':sum(x['passed'] for x in results),'total':len(results)},ensure_ascii=False))
raise SystemExit(0 if all(x['passed'] for x in results) else 1)
