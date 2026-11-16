// A direct renderer: block scanning followed by inline rendering, without a token tree.
const escape = (s, all = false) => s.replace(all ? /[&<>"']/g : /&(?!(?:#\d+|#x[\da-f]+|\w+);)|[<>"']/gi, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unescape = s => s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
function linkAt(src) {
  const offset = src[0] === '!' ? 1 : 0;
  if (src[offset] !== '[') return null;
  let depth = 1, end = offset + 1;
  for (; end < src.length; end++) {
    if (src[end] === '\\') { end++; continue; }
    if (src[end] === '[') depth++;
    if (src[end] === ']' && --depth === 0) break;
  }
  if (depth || src[end + 1] !== '(') return null;
  let pos = end + 2;
  while (pos < src.length && /\s/.test(src[pos])) pos++;
  let dest, title;
  if (src[pos] === '<') {
    const finish = src.indexOf('>', pos + 1);
    if (finish < 0) return null;
    dest = src.slice(pos + 1, finish); pos = finish + 1;
  } else {
    const start = pos; let level = 0;
    for (; pos < src.length; pos++) {
      const c = src[pos];
      if (c === '\\') { pos++; continue; }
      if (c === '(') level++;
      else if (c === ')') { if (!level) break; level--; }
      if (/\s/.test(c) && !level) break;
    }
    if (level) return null;
    dest = src.slice(start, pos);
  }
  const gap = pos;
  while (pos < src.length && /\s/.test(src[pos])) pos++;
  if (pos > gap && ['"', "'", '('].includes(src[pos])) {
    const close = src[pos] === '(' ? ')' : src[pos], start = ++pos;
    for (; pos < src.length; pos++) {
      if (src[pos] === '\\') pos++;
      else if (src[pos] === close) break;
    }
    if (pos >= src.length) return null;
    title = src.slice(start, pos++);
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  }
  if (src[pos] !== ')') return null;
  return [src.slice(0, pos + 1), src.slice(offset + 1, end), dest, title];
}
function inline(src, refs, inLink = false) {
  let out = '', m;
  while (src) {
    if ((m = /^\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/.exec(src))) out += escape(m[1]);
    else if ((m = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(src))) {
      let text = m[2].replace(/\n/g, ' ');
      if (/^ .* $/.test(text) && /[^ ]/.test(text)) text = text.slice(1,-1);
      out += '<code>' + escape(text,true) + '</code>';
    } else if ((m = /^(?: {2,}|\\)\n(?!\s*$)[ \t]*/.exec(src))) out += '<br>\n';
    else if ((m = linkAt(src))) {
      const href = escape(encodeURI(unescape(m[2].replace(/^<|>$/g,''))).replace(/%25/g,'%'));
      const title = m[3] == null ? '' : ' title="'+escape(unescape(m[3]))+'"';
      out += src[0] === '!' ? '<img src="'+href+'" alt="'+escape(unescape(m[1]))+'"'+title+'>' : '<a href="'+href+'"'+title+'>'+inline(m[1],refs,true)+'</a>';
    } else if ((m = /^!?\[([^\]]+)\](?:\[([^\]]*)\])?/.exec(src)) && refs[(m[2] || m[1]).toLowerCase().replace(/\s+/g,' ')]) {
      const ref=refs[(m[2] || m[1]).toLowerCase().replace(/\s+/g,' ')];
      const dest=/^<?([^ >]+)>?(?: +[\"'](.*)[\"'])?$/.exec(ref);
      const href=escape(dest?.[1]||ref),title=dest?.[2]?' title=\"'+escape(dest[2])+'\"':'';
      out += src[0]==='!'?'<img src=\"'+href+'\" alt=\"'+escape(m[1])+'\"'+title+'>':'<a href=\"'+href+'\"'+title+'>'+inline(m[1],Object.create(null),true)+'</a>';
    } else if ((m = /^<([a-z][\w+.-]{1,31}:[^\s<>]*)>/i.exec(src))) out += '<a href="'+escape(m[1])+'">'+escape(m[1])+'</a>';
    else if ((m = /^<([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]+)>/i.exec(src))) out += '<a href="mailto:'+escape(m[1])+'">'+escape(m[1])+'</a>';
    else if ((m = /^(?:<!--[\s\S]*?(?:-->|$)|<\/?[a-zA-Z][^<>]*>|<\?[\s\S]*?\?>|<![A-Z][^>]*>)/.exec(src))) out += m[0];
    else if (!inLink && (m = /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>]+/i.exec(src))) {
      m[0]=m[0].replace(/[.,:;!?]+$/,'');
      while(m[0].endsWith(')') && (m[0].match(/\)/g)||[]).length>(m[0].match(/\(/g)||[]).length)m[0]=m[0].slice(0,-1);
      out += '<a href="'+escape((m[0].startsWith('www.')?'http://':'')+m[0])+'">'+escape(m[0])+'</a>';
    } else if ((m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(src))) out += '<strong>'+inline(m[2],refs,inLink)+'</strong>';
    else if ((m = /^(\*|_)(?=\S)([\s\S]*?\S)\1/.exec(src))) out += '<em>'+inline(m[2],refs,inLink)+'</em>';
    else if ((m = /^(~{1,2})(?=\S)([\s\S]*?\S)\1(?!~)/.exec(src))) out += '<del>'+inline(m[2],refs,inLink)+'</del>';
    else {
      m = /^[^\\`*_[!<~\n ]+|^ +(?!(?: *\n))|^\n/.exec(src);
      if (!m) m=[src[0]];
      out += escape(m[0]);
    }
    src=src.slice(m[0].length);
  }
  return out;
}
const starts = s => /^(?: {0,3}(?:#{1,6}(?:\s|$)|>|`{3,}|~{3,}|(?:[-*_][ \t]*){3,}$|(?:[*+-]|1[.)])[ \t]+)| {0,3}<\/?(?:div|table|pre|script|style|section|ul|ol|li|p|h[1-6])\b)/i.test(s);
function blocks(lines, refs, tight=false) {
  let out='';
  for(let i=0;i<lines.length;) {
    let line=lines[i],m;
    if(!line.trim()){i++;continue;}
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
    if((m=/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line))){out+='<h'+m[1].length+'>'+inline((m[2]||'').trim().replace(/[ \t]+#+[ \t]*$/,''),refs)+'</h'+m[1].length+'>\n';i++;continue;}
    if(/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)){out+='<hr>\n';i++;continue;}
    if(/^ {0,3}>/.test(line)) {
      let body=[];while(i<lines.length && lines[i].trim()){if(!/^ {0,3}>/.test(lines[i])&&starts(lines[i]))break;body.push(lines[i++].replace(/^ {0,3}>[ \t]?/,''));}
      out+='<blockquote>\n'+blocks(body,refs)+'</blockquote>\n';continue;
    }
    if((m=/^ {0,3}([*+-]|\d{1,9}[.)])(?:[ \t]+(.*)|$)/.exec(line))) {
      const ordered=/\d/.test(m[1]), marker=ordered?m[1].slice(-1):m[1],tag=ordered?'ol':'ul'; let items=[],loose=false;
      while(i<lines.length){const match=/^( {0,3})([*+-]|\d{1,9}[.)])(?:([ \t]+)(.*)|$)/.exec(lines[i]);if(!match || (/\d/.test(match[2])!==ordered) || (ordered?match[2].slice(-1):match[2])!==marker)break;
        let indent=match[1].length+match[2].length+(match[3]?.length||1),body=[match[4]||''];i++;
        while(i<lines.length){if(!lines[i].trim()){if(i+1<lines.length && (/^ +\S/.test(lines[i+1])||/^ {0,3}(?:[*+-]|\d+[.)]) /.test(lines[i+1]))){loose=true;body.push('');i++;continue;}break;}if(new RegExp('^ {'+indent+'}').test(lines[i]))body.push(lines[i++].slice(indent));else if(!starts(lines[i])&&!/^ {0,3}(?:[*+-]|\d+[.)]) /.test(lines[i]))body.push(lines[i++]);else break;}
        items.push(body);
      }
      out+='<'+tag+(ordered&&parseInt(m[1])!==1?' start="'+parseInt(m[1])+'"':'')+'>\n';
      for(const body of items){let task=/^\[([ xX])\] +/.exec(body[0]);if(task)body[0]=body[0].slice(task[0].length);let html=blocks(body,refs,!loose);if(task)html=(loose?html.replace(/^<p>/,'<p><input '+(task[1]!==' '?'checked="" ':'')+'disabled="" type="checkbox"> '):'<input '+(task[1]!==' '?'checked="" ':'')+'disabled="" type="checkbox"> '+html);out+='<li>'+html+'</li>\n';}
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
        const row=(values,tag)=>'<tr>\n'+headers.map((_,j)=>'<'+tag+attrs[j]+'>'+inline(values[j]||'',refs)+'</'+tag+'>\n').join('')+'</tr>\n';
        out+='<table>\n<thead>\n'+row(headers,'th')+'</thead>\n';i+=2;let rows='';
        while(i<lines.length&&lines[i].trim()&&!starts(lines[i]))rows+=row(cells(lines[i++]),'td');
        if(rows)out+='<tbody>'+rows+'</tbody>';out+='</table>\n';continue;
      }
    }
    let body=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!starts(lines[i])){if(/^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i]))break;body.push(lines[i++]);}
    if(i<lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])){const level=lines[i++].trim()[0]==='='?1:2;out+='<h'+level+'>'+inline(body.join('\n').trim(),refs)+'</h'+level+'>\n';}
    else out+=(tight?'':'<p>')+inline(body.join('\n').trim(),refs)+(tight?'':'</p>\n');
  }
  return out;
}
export function parse(markdown) {
  const refs=Object.create(null);
  const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
  // Resolve definitions before rendering, including forward references.
  for(let i=0;i<lines.length;i++){const m=/^ {0,3}\[([^\]]+)\]:\s*(.*)$/.exec(lines[i]);if(m){const key=m[1].toLowerCase().replace(/\s+/g,' ');if(!(key in refs))refs[key]=m[2];lines[i]='';}}
  return blocks(lines,refs);
}
