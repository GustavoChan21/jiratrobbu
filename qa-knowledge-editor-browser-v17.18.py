#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, websocket, subprocess, tempfile, time, sys

ROOT=Path(__file__).resolve().parent
APP=ROOT/'app.js'
PORT=9348


def wait_json(url,timeout=10):
    end=time.time()+timeout
    last=None
    while time.time()<end:
        try:
            with urllib.request.urlopen(url,timeout=1) as r:
                return json.load(r)
        except Exception as e:
            last=e;time.sleep(.15)
    raise RuntimeError(last)


def send(ws,ident,method,params=None):
    ws.send(json.dumps({'id':ident,'method':method,'params':params or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get('id')==ident:
            if 'error' in msg:
                raise RuntimeError(msg['error'])
            result=msg.get('result',{})
            if 'exceptionDetails' in result:
                raise RuntimeError(result['exceptionDetails'])
            return result


def evaluate(ws,expr,ident):
    result=send(ws,ident,'Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
    return result.get('result',{}).get('value')


def main():
    app=APP.read_text()
    h0=app.index('function knowledgeRangeElement')
    h1=app.index('function KnowledgeRichTextEditor')
    helpers=app[h0:h1]
    profile=tempfile.mkdtemp(prefix='jira-knowledge-v1718-')
    proc=subprocess.Popen([
        'chromium','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        f'--remote-debugging-port={PORT}','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank'
    ],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        pages=wait_json(f'http://127.0.0.1:{PORT}/json/list')
        ws=websocket.create_connection(pages[0]['webSocketDebuggerUrl'],timeout=10)
        send(ws,1,'Runtime.enable')
        send(ws,2,'Page.enable')
        fixture=f'''(()=>{{
{helpers}
document.body.innerHTML=`<button id="fake-toolbar">Toolbar parent</button><input id="url" value="https://example.com/updated"><iframe id="frame"></iframe><div id="parent-state">0</div>`;
const frame=document.getElementById('frame'),doc=frame.contentDocument,win=frame.contentWindow;
doc.open();doc.write(`<!doctype html><html><body><div id="editor" contenteditable="true" spellcheck="false" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"><p>Inicio medio <a href="https://example.com/old">Panel Administrativo</a> final de texto</p></div></body></html>`);doc.close();
const editor=doc.getElementById('editor');
window.__qa={{frame,doc,win,editor,bookmark:null}};
function textNodeAtAbsolute(root,target){{let seen=0;const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){{const len=n.nodeValue.length;if(target<=seen+len)return [n,Math.max(0,target-seen)];seen+=len}}return [root,root.childNodes.length]}}
window.__setCaret=(needle,insideOffset=0)=>{{const text=editor.textContent;const abs=text.indexOf(needle)+insideOffset;const [n,o]=textNodeAtAbsolute(editor,abs);const r=doc.createRange();r.setStart(n,o);r.collapse(true);const s=win.getSelection();s.removeAllRanges();s.addRange(r);editor.focus();return {{abs,focusText:n.nodeValue,offset:o}}}};
window.__selectText=(needle)=>{{const text=editor.textContent;const start=text.indexOf(needle),end=start+needle.length;const [sn,so]=textNodeAtAbsolute(editor,start),[en,eo]=textNodeAtAbsolute(editor,end);const r=doc.createRange();r.setStart(sn,so);r.setEnd(en,eo);const s=win.getSelection();s.removeAllRanges();s.addRange(r);editor.focus();window.__qa.bookmark=knowledgeBookmarkFromRange(editor,r);return r.toString()}};
window.__blurToParent=()=>{{window.__qa.bookmark=knowledgeBookmarkFromRange(editor,win.getSelection().getRangeAt(0));document.getElementById('url').focus();return document.activeElement.id}};
window.__applyLink=()=>{{const r=knowledgeRangeFromBookmark(editor,window.__qa.bookmark);const before=editor.textContent;const next=knowledgeApplyLinkRange(editor,r,document.getElementById('url').value);const after=editor.textContent;const s=win.getSelection();s.removeAllRanges();s.addRange(next);editor.focus();return {{before,after,anchors:editor.querySelectorAll('a').length,href:editor.querySelector('a')?.getAttribute('href'),selection:s.toString(),collapsed:s.getRangeAt(0).collapsed}}}};
window.__selection=()=>{{const s=win.getSelection();if(!s.rangeCount)return null;const r=s.getRangeAt(0);return {{text:s.toString(),collapsed:r.collapsed,startOffset:r.startOffset,node:r.startContainer.nodeValue||r.startContainer.nodeName}}}};
window.__html=()=>editor.innerHTML;window.__text=()=>editor.textContent;
return true;
}})()'''
        ok=evaluate(ws,fixture,3)
        assert ok is True

        checks=[]
        # 1) Actual typing in the middle via CDP Input.insertText.
        pos=evaluate(ws,"__setCaret('medio',2)",4)
        send(ws,5,'Input.insertText',{'text':'XYZ'})
        t1=evaluate(ws,"({text:__text(),sel:__selection(),html:__html()})",6)
        checks.append(('type_middle_exact', 'meXYZdio' in t1['text']))
        checks.append(('caret_after_middle_insert', t1['sel']['collapsed'] is True))

        # 2) Simulate repeated parent React renders; iframe caret/content must not move.
        before_sel=evaluate(ws,"__selection()",7)
        evaluate(ws,"for(let i=0;i<40;i++){document.getElementById('parent-state').textContent=String(i);document.body.dataset.render=String(i)};true",8)
        send(ws,9,'Input.insertText',{'text':'Q'})
        t2=evaluate(ws,"({text:__text(),sel:__selection(),anchors:__qa.editor.querySelectorAll('a').length})",10)
        checks.append(('parent_rerender_does_not_steal_caret', 'meXYZQdio' in t2['text']))
        checks.append(('parent_rerender_preserves_link', t2['anchors']==1))

        # 3) Move caret to another requested location and type there.
        evaluate(ws,"__setCaret('final',3)",11)
        send(ws,12,'Input.insertText',{'text':'-AQUI-'})
        t3=evaluate(ws,"__text()",13)
        checks.append(('caret_moves_to_requested_position', 'fin-AQUI-al' in t3))

        # 4) Select linked text, move focus to parent URL field, restore selection, edit link.
        selected=evaluate(ws,"__selectText('Panel Administrativo')",14)
        blurred=evaluate(ws,"__blurToParent()",15)
        linked=evaluate(ws,"__applyLink()",16)
        checks.append(('link_selection_exact', selected=='Panel Administrativo'))
        checks.append(('toolbar_focus_may_leave_frame', blurred=='url'))
        checks.append(('link_edit_preserves_visible_text', linked['before']==linked['after']))
        checks.append(('single_anchor_after_link_edit', linked['anchors']==1))
        checks.append(('link_href_updated', linked['href']=='https://example.com/updated'))
        checks.append(('caret_collapsed_after_link', linked['collapsed'] is True))

        # 5) Type immediately after edited link. It must stay outside the anchor.
        send(ws,17,'Input.insertText',{'text':' DESPUES '})
        link_after=evaluate(ws,"(()=>{const a=__qa.editor.querySelector('a');return {text:__text(),anchorText:a.textContent,anchorCount:__qa.editor.querySelectorAll('a').length,html:__html()}})()",18)
        checks.append(('typing_after_link_is_outside_anchor', link_after['anchorText']=='Panel Administrativo'))
        checks.append(('typing_after_link_visible', 'Panel Administrativo DESPUES ' in link_after['text'].replace('\u00a0',' ')))
        checks.append(('typing_after_link_no_duplicate_anchor', link_after['anchorCount']==1))

        # 6) Empty editor typing should start exactly where clicked/focused, not jump.
        empty=evaluate(ws,"(()=>{__qa.editor.innerHTML='<p><br></p>';const p=__qa.editor.querySelector('p');const r=__qa.doc.createRange();r.setStart(p,0);r.collapse(true);const s=__qa.win.getSelection();s.removeAllRanges();s.addRange(r);__qa.editor.focus();return true})()",19)
        send(ws,20,'Input.insertText',{'text':'Primer texto estable'})
        t4=evaluate(ws,"({text:__text(),sel:__selection()})",21)
        checks.append(('empty_editor_accepts_typing', t4['text']=='Primer texto estable'))
        checks.append(('empty_editor_caret_remains_collapsed', t4['sel']['collapsed'] is True))

        # 7) Parent DOM mutations after empty typing still cannot steal the caret.
        evaluate(ws,"document.getElementById('parent-state').replaceChildren(document.createTextNode('render nuevo'));true",22)
        send(ws,23,'Input.insertText',{'text':' + continuación'})
        t5=evaluate(ws,"__text()",24)
        checks.append(('continued_typing_after_parent_mutation', t5=='Primer texto estable + continuación'))

        failed=[name for name,passed in checks if not passed]
        print('KNOWLEDGE_EDITOR_BROWSER_V1718')
        for name,passed in checks: print(('PASS' if passed else 'FAIL'),name)
        print('FINAL_HTML',link_after['html'])
        print('RESULT',len(checks)-len(failed),'PASS /',len(failed),'FAIL')
        return 0 if not failed else 2
    finally:
        try: ws.close()
        except Exception: pass
        proc.terminate()
        try: proc.wait(timeout=3)
        except subprocess.TimeoutExpired: proc.kill()

if __name__=='__main__':
    raise SystemExit(main())
