// A direct renderer: block scanning followed by inline rendering, without a token tree.
const escape = (s, all = false) => s.replace(all ? /[&<>"']/g : /&(?!(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z0-9]*);)|[<>"']/gi, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numericText = s => s.replace(/&#(x[0-9a-f]{1,6}|[0-9]{1,7});/gi,(m,x)=>{const n=x[0].toLowerCase()==='x'?parseInt(x.slice(1),16):+x;return !n||n>0x10ffff||(n>=0xd800&&n<=0xdfff)?'\ufffd':n===38?'&amp;':String.fromCodePoint(n);});
const unescape = s => s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
const labelKey = s => s.replace(/\s+/g,' ').trim().toLowerCase().toUpperCase().toLowerCase();
const inlineTag = /^(?:<!--(?:>|->|[\s\S]*?-->)|<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<\?[\s\S]*?\?>|<![a-zA-Z]+\s[\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>)/;
function validInlineTail(tail) { return /^\([ \t\n]*(?:<(?:\\.|[^<>\n\\])*>|[^ \t\n]+)?(?:[ \t\n]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?[ \t\n]*\)/.test(tail); }
function linkAt(src, refs) {
  const offset = src[0] === '!' ? 1 : 0;
  if(src[offset]!=='[')return null;
  let depth=1,end=offset+1;
  for(;end<src.length;end++) {
    if(src[end]==='\\'){end++;continue;}
    if(src[end]==='`') {
      const code=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(src.slice(end));
      if(code){end+=code[0].length-1;continue;}
    }
    if(src[end]==='<') {
      const html=inlineTag.exec(src.slice(end)) || /^<[^\s<>]+>/.exec(src.slice(end));
      if(html){end+=html[0].length-1;continue;}
    }
    if(src[end]==='[')depth++;
    if(src[end]===']'&&--depth===0)break;
  }
  if(depth)return null;
  const label=src.slice(offset+1,end);
  if(src[end+1]!=='(' || !validInlineTail(src.slice(end+1))) {
    let finish=end+1,key=label;
    if(src[finish]==='[') {const ref=/^\[((?:\\.|[^\[\]\\])*)\]/.exec(src.slice(finish));if(!ref)return null;key=ref[1]||label;finish+=ref[0].length;}
    const ref=refs[labelKey(key)]; if(!ref)return null;
    return [src.slice(0,finish),label,ref.href,ref.title];
  }
  let pos=end+2;while(/[ \t\n]/.test(src[pos]||'x'))pos++;
  let dest,title;
  if(src[pos]==='<') {
    const match=/^<((?:\\[^\n]|[^<>\n\\])*)>/.exec(src.slice(pos));if(!match)return null;
    dest=match[1];pos+=match[0].length;
  } else {
    const start=pos;let level=0;
    for(;pos<src.length;pos++) {
      const c=src[pos];if(c==='\\'){pos++;continue;}
      if(c==='(')level++;else if(c===')'){if(!level)break;level--;}
      if(/[ \t\n\x00-\x1f]/.test(c))break;
    }
    if(level)return null;dest=src.slice(start,pos);
  }
  const gap=pos;while(/[ \t\n]/.test(src[pos]||'x'))pos++;
  if(pos>gap&&['"',"'",'('].includes(src[pos])) {
    const close=src[pos]==='('?')':src[pos],start=++pos;
    for(;pos<src.length;pos++){if(src[pos]==='\\')pos++;else if(src[pos]===close)break;}
    if(pos>=src.length)return null;title=src.slice(start,pos++);
    while(/[ \t\n]/.test(src[pos]||'x'))pos++;
  }
  if(src[pos]!==')')return null;
  return [src.slice(0,pos+1),label,dest,title];
}
function altText(html) { return html.replace(/<img [^>]*alt="([^"]*)"[^>]*>/g,'$1').replace(/<[^>]*>/g,''); }
// Delimiter runs are paired after opaque inline constructs have been scanned.
function pairDelimiters(parts) {
  const stack=[];
  for(let i=0;i<parts.length;i++) {
    const d=parts[i]; if(typeof d==='string')continue;
    if(d.close) {
      for(let j=stack.length-1;j>=0 && d.n;j--) {
        const o=stack[j];
        if(o.char!==d.char || !o.n)continue;
        if((o.close||d.open) && (o.original+d.original)%3===0 && (o.original%3!==0 || d.original%3!==0))continue;
        while(o.n && d.n) {
          const n=o.n>=2&&d.n>=2?2:1, tag=n===2?'strong':'em';
          o.n-=n;d.n-=n;o.after='<'+tag+'>'+o.after;d.before+='</'+tag+'>';
        }
        stack.splice(j+1);
        if(!o.n)stack.splice(j,1);
        if(d.n)j=stack.length;
      }
    }
    if(d.open&&d.n)stack.push(d);
  }
  return parts.map(d=>typeof d==='string'?d:d.before+d.char.repeat(d.n)+d.after).join('');
}
function inline(src, refs, inLink = false) {
  let out = '', m, parts=[], previous='';
  while (src) {
    if ((m = /^\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/.exec(src))) out += escape(m[1]);
    else if ((m = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(src))) {
      let text = m[2].replace(/\n/g, ' ');
      if (/^ .* $/.test(text) && /[^ ]/.test(text)) text = text.slice(1,-1);
      out += '<code>' + escape(text,true) + '</code>';
    } else if ((m = /^(?: {2,}|\\)\n(?!\s*$)[ \t]*/.exec(src))) out += '<br>';
    else if ((m = linkAt(src,refs)) && (src[0]==='!' || !inline(m[1],refs,true).includes('<a '))) {
      const href = escape(encodeURI(unescape(m[2])).replace(/%25/g,'%'));
      const title = m[3] == null ? '' : ' title="'+escape(unescape(m[3]))+'"';
      out += src[0] === '!' ? '<img src="'+href+'" alt="'+altText(inline(m[1],refs,true))+'"'+title+'>' : '<a href="'+href+'"'+title+'>'+inline(m[1],refs,true)+'</a>';
    } else if ((m = /^<([a-z][\w+.-]{1,31}:[^\s<>]*)>/i.exec(src))) out += '<a href="'+escape(encodeURI(m[1]).replace(/%25/g,'%'))+'">'+escape(m[1])+'</a>';
    else if ((m = /^<([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]+)>/i.exec(src))) out += '<a href="mailto:'+escape(encodeURI(m[1]).replace(/%25/g,'%'))+'">'+escape(m[1])+'</a>';
    else if ((m = inlineTag.exec(src))) out += m[0];
    else if (!inLink && (m = /^(?:(?:mailto:|xmpp:)[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?|[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-]))/.exec(src))) {
      if(!m[0].startsWith('xmpp:'))m[0]=m[0].replace(/\/.*$/,'');
      m[0]=m[0].replace(/\.$/,'');out+='<a href="'+escape((/^(?:mailto|xmpp):/.test(m[0])?'':'mailto:')+m[0])+'">'+escape(m[0])+'</a>';
    }
    else if (!inLink && (m = /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]+/i.exec(src))) {
      m[0]=m[0].replace(/&[a-zA-Z0-9]+;$/,'').replace(/[.,:;!?*_\x27\"~]+$/,'');
      while(m[0].endsWith(')') && (m[0].match(/\)/g)||[]).length>(m[0].match(/\(/g)||[]).length)m[0]=m[0].slice(0,-1);
      out += '<a href="'+escape(encodeURI((m[0].startsWith('www.')?'http://':'')+m[0]).replace(/%25/g,'%'))+'">'+escape(m[0])+'</a>';
    } else if ((m = /^(\*+|_+)/.exec(src))) {
      const char=m[0][0], before=previous, after=src[m[0].length]||'';
      const ps=!before||/\s/.test(before), ns=!after||/\s/.test(after);
      const pp=!!before&&/[\p{P}\p{S}]/u.test(before), np=!!after&&/[\p{P}\p{S}]/u.test(after);
      const left=!ns&&(!np||ps||pp), right=!ps&&(!pp||ns||np);
      parts.push(out);out='';parts.push({char,n:m[0].length,original:m[0].length,open:left&&(char==='*'||!right||pp),close:right&&(char==='*'||!left||np),before:'',after:''});
    }
    else if ((m = /^~{3,}/.exec(src))) out+=m[0];
    else if ((m = /^(~{1,2})(?=\S)([\s\S]*?\S)\1(?!~)/.exec(src))) out += '<del>'+inline(m[2],refs,inLink)+'</del>';
    else {
      m = /^[^\\`*_[!<~\n ]+|^ +(?!(?: *\n))|^\n/.exec(src);
      if (!m) m=[src[0]==='`' ? /^`+/.exec(src)[0] : src[0]];
      const stop=m[0].search(/(?:https?:\/\/|ftp:\/\/|www\.|(?:mailto:|xmpp:)?[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-]))/);
      if(stop>0)m[0]=m[0].slice(0,stop);
      out += escape(numericText(m[0]));
    }
    previous=m[0].at(-1);src=src.slice(m[0].length);
  }
  parts.push(out);return pairDelimiters(parts);
}
function definitionAt(lines,i) {
  if(!/^ {0,3}\[/.test(lines[i]))return null;
  const source=lines.slice(i).join('\n');
  const m=/^ {0,3}\[((?:\\[\s\S]|[^\[\]\\])+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\)))? *(?:\n+|$)/.exec(source);
  if(!m)return null;
  if(m[1].length>999||!m[1].trim())return null;
  let href=m[2];
  if(href[0]==='<')href=href.slice(1,-1);
  else {let depth=0;for(let j=0;j<href.length;j++){if(href[j]==='\\'){j++;continue;}if(href[j]==='(')depth++;if(href[j]===')'&&--depth<0)return null;}if(depth)return null;}
  return {key:labelKey(m[1]),href:unescape(href),title:m[3]?unescape(m[3].slice(1,-1)):undefined,count:m[0].replace(/\n+$/,'').split('\n').length};
}
const starts = s => /^(?: {0,3}(?:#{1,6}(?:\s|$)|>|`{3,}|~{3,}|(?:[-*_][ \t]*){3,}$|(?:[*+-]|1[.)])[ \t]+)| {0,3}<\/?(?:div|table|pre|script|style|section|ul|ol|li|p|h[1-6])\b)/i.test(s);
function blocks(lines, refs, tight=false, collecting=false) {
  const renderInline=collecting ? () => '' : inline;
  let out='';
  for(let i=0;i<lines.length;) {
    let line=lines[i],m;
    if(!line.trim()){i++;continue;}
    const def=definitionAt(lines,i);if(def){if(!(def.key in refs))refs[def.key]={href:def.href,title:def.title};i+=def.count;continue;}
    if((m=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)) && !(m[1][0]==='`' && m[2].includes('`'))) {
      const fence=m[1], lang=unescape(m[2].trim()).split(/\s/)[0]; let body=[]; i++;
      const close=new RegExp('^ {0,3}'+fence[0]+'{'+fence.length+',} *$');
      while(i<lines.length && !close.test(lines[i]))body.push(lines[i++].replace(new RegExp('^ {0,'+(line.match(/^ */)[0].length)+'}'),''));
      if(i<lines.length)i++;
      out+='<pre><code'+(lang?' class="language-'+escape(lang)+'"':'')+'>'+escape(body.join('\n')+(body.length?'\n':''),true)+'</code></pre>\n';continue;
    }
    if(/^(?: {4}| {0,3}\t)/.test(line)) {
      let body=[];while(i<lines.length && (/^(?: {4}| {0,3}\t)/.test(lines[i])||!lines[i].trim()))body.push(lines[i++].replace(/^(?: {4}| {0,3}\t)/,''));
      out+='<pre><code>'+escape(body.join('\n').replace(/\n+$/,'')+'\n',true)+'</code></pre>\n';continue;
    }
    if((m=/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line))){out+='<h'+m[1].length+'>'+renderInline((m[2]||'').trim().replace(/[ \t]+#+[ \t]*$/,''),refs)+'</h'+m[1].length+'>\n';i++;continue;}
    if(/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)){out+='<hr>\n';i++;continue;}
    if(/^ {0,3}>/.test(line)) {
      let body=[];while(i<lines.length && lines[i].trim()){if(!/^ {0,3}>/.test(lines[i])&&starts(lines[i]))break;body.push(lines[i++].replace(/^ {0,3}>[ \t]?/,''));}
      out+='<blockquote>\n'+blocks(body,refs,false,collecting)+'</blockquote>\n';continue;
    }
    if((m=/^ {0,3}([*+-]|\d{1,9}[.)])(?:[ \t]+(.*)|$)/.exec(line))) {
      const ordered=/\d/.test(m[1]), marker=ordered?m[1].slice(-1):m[1],tag=ordered?'ol':'ul'; let items=[],loose=false;
      while(i<lines.length){const match=/^( {0,3})([*+-]|\d{1,9}[.)])(?:([ \t]+)(.*)|$)/.exec(lines[i]);if(!match || (/\d/.test(match[2])!==ordered) || (ordered?match[2].slice(-1):match[2])!==marker)break;
        let indent=match[1].length+match[2].length+(match[3]?.length||1),body=[match[4]||''];i++;
        while(i<lines.length){if(!lines[i].trim()){if(i+1<lines.length && (/^ +\S/.test(lines[i+1])||/^ {0,3}(?:[*+-]|\d+[.)]) /.test(lines[i+1]))){loose=true;body.push('');i++;continue;}break;}if(new RegExp('^ {'+indent+'}').test(lines[i]))body.push(lines[i++].slice(indent));else if(!starts(lines[i])&&!/^ {0,3}(?:[*+-]|\d+[.)]) /.test(lines[i]))body.push(lines[i++]);else break;}
        items.push(body);
      }
      out+='<'+tag+(ordered&&parseInt(m[1])!==1?' start="'+parseInt(m[1])+'"':'')+'>\n';
      for(const body of items){let task=/^\[([ xX])\] +/.exec(body[0]);if(task)body[0]=body[0].slice(task[0].length);let html=blocks(body,refs,!loose,collecting);if(task)html=(loose?html.replace(/^<p>/,'<p><input '+(task[1]!==' '?'checked="" ':'')+'disabled="" type="checkbox"> '):'<input '+(task[1]!==' '?'checked="" ':'')+'disabled="" type="checkbox"> '+html);out+='<li>'+html+'</li>\n';}
      out+='</'+tag+'>\n';continue;
    }
    if(/^ {0,3}<!--/.test(line)) {
      let body=[];do{body.push(lines[i++]);}while(i<lines.length&&!body.at(-1).includes('-->'));
      out+=body.join('\n')+(i<lines.length?'\n':'');continue;
    }
    if(/^ {0,3}(?:<!--|<\/?(?:address|article|aside|div|table|pre|script|style|section|ul|ol|li|p|h[1-6])\b|<![A-Z]|<\?)/i.test(line)){let body=[];while(i<lines.length&&lines[i].trim())body.push(lines[i++]);out+=body.join('\n')+(i<lines.length?'\n':'');continue;}
    if(i+1<lines.length && (line.includes('|')||lines[i+1].includes('|')) && /^ {0,3}\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/.test(lines[i+1]) && lines[i+1].includes('-')) {
      const cells = row => row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
      const headers=cells(line),align=cells(lines[i+1]);
      if(headers.length===align.length){
        const attrs=align.map(x=>x.startsWith(':')?(x.endsWith(':')?' align="center"':' align="left"'):(x.endsWith(':')?' align="right"':''));
        const row=(values,tag)=>'<tr>\n'+headers.map((_,j)=>'<'+tag+attrs[j]+'>'+renderInline(values[j]||'',refs)+'</'+tag+'>\n').join('')+'</tr>\n';
        out+='<table>\n<thead>\n'+row(headers,'th')+'</thead>\n';i+=2;let rows='';
        while(i<lines.length&&lines[i].trim()&&!starts(lines[i]))rows+=row(cells(lines[i++]),'td');
        if(rows)out+='<tbody>'+rows+'</tbody>';out+='</table>\n';continue;
      }
    }
    let body=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!starts(lines[i])){if(/^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i]))break;body.push(lines[i++]);}
    if(i<lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])){const level=lines[i++].trim()[0]==='='?1:2;out+='<h'+level+'>'+renderInline(body.join('\n').trim(),refs)+'</h'+level+'>\n';}
    else out+=(tight?'':'<p>')+renderInline(body.join('\n').trimStart(),refs)+(tight?'':'</p>\n');
  }
  return out;
}
export function parse(markdown) {
  const refs=Object.create(null);
  const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
  // A collection pass uses the same block boundaries as rendering so definitions
  // inside code and paragraphs cannot accidentally become references.
  blocks(lines,refs,false,true);
  return blocks(lines,refs);
}
