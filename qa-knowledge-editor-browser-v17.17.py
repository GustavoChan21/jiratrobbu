#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, websocket, subprocess, tempfile, time, os, signal, sys

ROOT=Path(__file__).resolve().parent
APP=ROOT/'app-v17.17.0.js'
PORT=9333

def wait_json(url,timeout=10):
    end=time.time()+timeout
    last=None
    while time.time()<end:
        try:
            with urllib.request.urlopen(url,timeout=1) as r:
                return json.load(r)
        except Exception as e:
            last=e; time.sleep(.2)
    raise RuntimeError(last)

def evaluate(ws,expr,ident):
    ws.send(json.dumps({'id':ident,'method':'Runtime.evaluate','params':{'expression':expr,'returnByValue':True}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get('id')==ident:
            if 'exceptionDetails' in msg.get('result',{}):
                raise RuntimeError(msg['result']['exceptionDetails'])
            return msg['result']['result'].get('value')

def main():
    app=APP.read_text()
    helper_start=app.index('function knowledgeRangeElement')
    helper_end=app.index('function KnowledgeRichTextEditor')
    helpers=app[helper_start:helper_end]
    norm_start=app.index('const KNOWLEDGE_COVER_FONTS')
    norm_end=app.index('function knowledgeEditorSnapshot')
    normalizers=app[norm_start:norm_end]
    profile=tempfile.mkdtemp(prefix='jira-knowledge-cdp-')
    cmd=['chromium','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--remote-debugging-port={PORT}','--remote-allow-origins=*',f'--user-data-dir={profile}','about:blank']
    proc=subprocess.Popen(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        pages=wait_json(f'http://127.0.0.1:{PORT}/json/list')
        ws=websocket.create_connection(pages[0]['webSocketDebuggerUrl'],timeout=10)
        link_expr=f'''(()=>{{
{helpers}
const root=document.createElement('div');root.contentEditable='true';
root.innerHTML='<p>Para acceder al Panel Administrativo Trobbu tenemos que acceder al siguiente enlace Panel Administrativo, que nos llevará al login y luego podremos continuar editando.</p>';document.body.innerHTML='';document.body.appendChild(root);
const textNode=root.querySelector('p').firstChild,phrase='Panel Administrativo';const first=textNode.nodeValue.indexOf(phrase),second=textNode.nodeValue.indexOf(phrase,first+phrase.length);
const range=document.createRange();range.setStart(textNode,second);range.setEnd(textNode,second+phrase.length);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
const bookmark=knowledgeBookmarkFromRange(root,range),beforeText=knowledgeVisibleTextSnapshot(root);sel.removeAllRanges();const restored=knowledgeRangeFromBookmark(root,bookmark);knowledgeApplyLinkRange(root,restored,'https://principal.trobbu.com/api/web/admin');const afterText=knowledgeVisibleTextSnapshot(root),anchor=root.querySelector('a');
const caret=document.createRange();caret.setStartAfter(anchor);caret.collapse(true);caret.insertNode(document.createTextNode(' y después seguir escribiendo'));const anchorAfterTyping=root.querySelector('a');const editRange=document.createRange();editRange.selectNodeContents(anchorAfterTyping);knowledgeApplyLinkRange(root,editRange,'https://principal.trobbu.com/admin');const anchors=[...root.querySelectorAll('a')];
return {{textPreserved:beforeText===afterText,anchorCount:anchors.length,anchorText:anchors[0]?.textContent||'',href:anchors[0]?.getAttribute('href')||'',continuedText:root.textContent.includes('y después seguir escribiendo'),linkPreservedAfterTyping:!!anchorAfterTyping&&anchorAfterTyping.textContent===phrase,noDuplicate:(root.textContent.match(/Para acceder al Panel Administrativo Trobbu/g)||[]).length===1,html:root.innerHTML}};
}})()'''
        link=evaluate(ws,link_expr,1)
        link_checks=[link['textPreserved'],link['anchorCount']==1,link['anchorText']=='Panel Administrativo',link['href']=='https://principal.trobbu.com/admin',link['continuedText'],link['linkPreservedAfterTyping'],link['noDuplicate']]
        print('LINK_FLOW',json.dumps(link,ensure_ascii=False))
        print('LINK_FLOW_PASS',all(link_checks))

        block_expr=f'''(()=>{{
{normalizers}
const blocks=[
 {{id:'cover',type:'cover',template:'forest',eyebrow:'TROBBU',title:'Manual',subtitle:'Sub',meta:'Interno',show_logo:true,page_break:true}},
 {{id:'rt',type:'richtext',html:'<p><strong>Texto</strong> con <a href="https://example.com">link</a> y <span style="color:#123456;font-size:16px">estilo</span></p>',line_height:'1.5'}},
 {{id:'h1',type:'heading1',text:'H1'}},{{id:'h5',type:'heading5',text:'H5'}},{{id:'list',type:'list',text:'Uno\\nDos',list_style:'ordered'}},{{id:'quote',type:'quote',text:'Cita',author:'Autor'}},{{id:'call',type:'callout',text:'Contenido',title:'Importante',tone:'warning'}},{{id:'code',type:'code',text:'const x=1;',language:'javascript'}},{{id:'img',type:'image',media_id:'m1',alt:'Alt',caption:'Pie',align:'wide'}},{{id:'video',type:'video',url:'https://youtu.be/abc',caption:'Video'}},{{id:'div',type:'divider'}},{{id:'pb',type:'pagebreak'}}
];
const out=normalizeKnowledgeBlocks(blocks),rich=out.find(x=>x.id==='rt');
return {{count:out.length,types:out.map(x=>x.type),linkPreserved:rich.html.includes('href=\"https://example.com\"'),strongPreserved:rich.html.includes('<strong>Texto</strong>')||rich.html.includes('<b>Texto</b>'),stylePreserved:/color:#123456/.test(rich.html)&&/font-size:16px/.test(rich.html),imageAlign:out.find(x=>x.type==='image')?.align,calloutTone:out.find(x=>x.type==='callout')?.tone}};
}})()'''
        block=evaluate(ws,block_expr,2)
        expected=['cover','richtext','heading1','heading5','list','quote','callout','code','image','video','divider','pagebreak']
        block_checks=[block['count']==len(expected),block['types']==expected,block['linkPreserved'],block['strongPreserved'],block['stylePreserved'],block['imageAlign']=='wide',block['calloutTone']=='warning']
        print('BLOCK_ROUNDTRIP',json.dumps(block,ensure_ascii=False))
        print('BLOCK_ROUNDTRIP_PASS',all(block_checks))
        return 0 if all(link_checks+block_checks) else 2
    finally:
        proc.terminate()
        try: proc.wait(timeout=3)
        except subprocess.TimeoutExpired: proc.kill()

if __name__=='__main__':
    raise SystemExit(main())
