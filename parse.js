// A direct renderer: block scanning followed by inline rendering, without a token tree.
const escape = (s, all = false) => s.replace(all ? /[&<>"']/g : /&(?!(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z0-9]*);)|[<>"']/gi, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numericText = s => s.replace(/&#(x[0-9a-f]{1,6}|[0-9]{1,7});/gi,(m,x)=>{const n=x[0].toLowerCase()==='x'?parseInt(x.slice(1),16):+x;return !n||n>0x10ffff||(n>=0xd800&&n<=0xdfff)?'\ufffd':n===38?'&amp;':String.fromCodePoint(n);});
const unescape = s => s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
const labelKey = s => s.replace(/\s+/g,' ').trim().toLowerCase().toUpperCase().toLowerCase();
const inlineStateKey=Symbol('inlineState');
const inlineTag = /^(?:<!--(?:>|->|[\s\S]*?-->)|<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>|<\?[\s\S]*?\?>|<![a-zA-Z]+\s[\s\S]*?>|<!\[CDATA\[[\s\S]*?\]\]>)/;
function linkAt(src, refs) {
  const offset = src[0] === '!' ? 1 : 0;
  if(src[offset]!=='[')return null;
  const direct=linkGrammar.exec(src);
  if(!direct){
    const match=refGrammar.exec(src)||shortRefGrammar.exec(src);if(!match)return null;
    const ref=refs[labelKey(match[2]||match[1])];if(!ref)return null;
    if(labelCrossesTag(src,match[1],offset))return null;
    return [match[0],match[1],ref.href,ref.title];
  }
  const label=direct[1],end=offset+1+label.length;
  if(labelCrossesTag(src,label,offset))return null;
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
// Reject labels whose closing bracket falls inside an HTML tag or autolink.
function labelCrossesTag(src,label,offset){
  for(let j=0;j<label.length;j++){
    if(label[j]==='\\'){j++;continue;}
    if(label[j]==='`'){const code=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(label.slice(j));if(code){j+=code[0].length-1;continue;}}
    if(label[j]==='<'){const tag=inlineTag.exec(src.slice(offset+1+j))||/^<[^\s<>]+>/.exec(src.slice(offset+1+j));if(tag){if(tag[0].length>label.length-j)return true;j+=tag[0].length-1;}}
  }
  return false;
}
function altText(html) { return html.replace(/<img [^>]*alt="([^"]*)"[^>]*>/g,'$1').replace(/<[^>]*>/g,''); }
// GFM delimiter grammar distinguishes opener, closer, and dual-purpose runs.
// Mask opaque constructs before matching, then render each matched interior.
const emOpen = new RegExp("^(?:\\*+(?:((?!\\*)(?!~)[\\p{P}\\p{S}])|([^\\s*]))?)|^_+(?:((?!_)(?!~)[\\p{P}\\p{S}])|([^\\s_]))?","u");
const emCloseStar = new RegExp("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)(?!~)[\\p{P}\\p{S}](\\*+)(?=[\\s]|$)|(?:[^\\s\\p{P}\\p{S}]|~)(\\*+)(?!\\*)(?=(?!~)[\\s\\p{P}\\p{S}]|$)|(?!\\*)(?!~)[\\s\\p{P}\\p{S}](\\*+)(?=(?:[^\\s\\p{P}\\p{S}]|~))|[\\s](\\*+)(?!\\*)(?=(?!~)[\\p{P}\\p{S}])|(?!\\*)(?!~)[\\p{P}\\p{S}](\\*+)(?!\\*)(?=(?!~)[\\p{P}\\p{S}])|(?:[^\\s\\p{P}\\p{S}]|~)(\\*+)(?=(?:[^\\s\\p{P}\\p{S}]|~))","gu");
const emCloseUnder = new RegExp("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[\\p{P}\\p{S}](_+)(?=[\\s]|$)|[^\\s\\p{P}\\p{S}](_+)(?!_)(?=[\\s\\p{P}\\p{S}]|$)|(?!_)[\\s\\p{P}\\p{S}](_+)(?=[^\\s\\p{P}\\p{S}])|[\\s](_+)(?!_)(?=[\\p{P}\\p{S}])|(?!_)[\\p{P}\\p{S}](_+)(?!_)(?=[\\p{P}\\p{S}])","gu");
const delOpen = new RegExp("^~~?(?:((?!~)[\\p{P}\\p{S}])|[^\\s~])","u");
const delClose = new RegExp("^[^~]+(?=[^~])|(?!~)[\\p{P}\\p{S}](~~?)(?=[\\s]|$)|[^\\s\\p{P}\\p{S}](~~?)(?!~)(?=[\\s\\p{P}\\p{S}]|$)|(?!~)[\\s\\p{P}\\p{S}](~~?)(?=[^\\s\\p{P}\\p{S}])|[\\s](~~?)(?!~)(?=[\\p{P}\\p{S}])|(?!~)[\\p{P}\\p{S}](~~?)(?!~)(?=[\\p{P}\\p{S}])|[^\\s\\p{P}\\p{S}](~~?)(?=[^\\s\\p{P}\\p{S}])","gu");
const opaqueInline = new RegExp("\\[(?:[^\\[\\]`]|(?<a>`+)[^`]+\\k<a>(?!`))*?\\]\\((?:\\\\[\\s\\S]|[^\\\\\\(\\)]|\\((?:\\\\[\\s\\S]|[^\\\\\\(\\)])*\\))*\\)|(?<!`)()(?<b>`+)[^`]+\\k<b>(?!`)|<(?! )[^<>]*?>","g");
const referenceMask = new RegExp("!?\\[((?:[^\\[\\]\\\\`]*(?:\\[(?:\\[(?:\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\]))){0,999}?[^\\[\\]\\\\`]*?)\\]\\[((?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\]){1,999})\\]|!?\\[((?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\]){1,999})\\](?:\\[\\])?(?!\\()","g");
const maskEscapes = new RegExp("(`+)(?:[^`]|[^`][\\s\\S]*?[^`])\\1(?!`)|`+|\\\\([\\p{P}\\p{S}])","gu");
const linkGrammar = new RegExp("^!?\\[((?:\\[(?:\\[(?:\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\])|[^\\[\\]\\\\`])*?)\\]\\([ \\t\\n]*(<(?:\\\\.|[^\\n<>\\\\])+>|[^ \\t\\n\\x00-\\x1f]+|(?=\\)))(?:(?:[ \\t]+(?:\\n[ \\t]*)?|\\n[ \\t]*)(\"(?:\\\\[\\s\\S]|[^\"\\\\])*\"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|\\((?:\\\\[\\s\\S]|[^)\\\\])*\\)))?[ \\t\\n]*\\)","");
const refGrammar = new RegExp("^!?\\[((?:\\[(?:\\[(?:\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\])|[^\\[\\]\\\\`])*?)\\]\\[((?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\\\n]|\\n(?![ \\t]*\\n))+)\\]","");
const shortRefGrammar = new RegExp("^!?\\[((?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\\\n]|\\n(?![ \\t]*\\n))+)\\](?:\\[\\])?","");

function maskedInline(src,refs) {
  const replaceRef=raw=>{
    const bracket=raw.lastIndexOf('['),key=raw.slice(bracket+1,-1);
    if(!refs[labelKey(key)])return raw;
    if(bracket>1&&raw[0]!=='!'){
      const label=raw.slice(1,bracket-1);
      if(hasExplicitLink(label,refs))return '['+label.replace(referenceMask,replaceRef)+']['+'a'.repeat(raw.length-bracket-2)+']';
    }
    return '['+'a'.repeat(raw.length-2)+']';
  };
  return src.replace(referenceMask,replaceRef).replace(maskEscapes,(raw,code,escaped)=>escaped?'+'.repeat(raw.length):code?code+raw.slice(code.length,-code.length).replace(/`/g,'+')+code:raw)
    .replace(opaqueInline,(raw,prefix)=>{const n=prefix?prefix.length:0;return raw.slice(0,n)+'['+'a'.repeat(raw.length-n-2)+']';});
}
function delimiterSpan(src,mask,previous,offset,isDel=false) {
  const opener=(isDel?delOpen:emOpen).exec(src);if(!opener||(!isDel&&!opener.slice(1,5).some(Boolean)))return null;
  const symbol=src[0],same=previous===symbol;
  let start=offset;while(start>0&&mask[start-1]===symbol)start--;
  const before=[...mask.slice(Math.max(0,start-2),start)].at(-1)||'';
  const punct=c=>!!c&&/^(?![*_])[\s\p{P}\p{S}]/u.test(c);
  if(start<offset)previous=before;
  const isPunct=start<offset?(before==='*'||before==='_'||punct(before)):punct(previous);
  if(!isDel&&opener[4]&&/[\p{L}\p{N}]/u.test(previous))return null;
  const following=opener[1]||opener[3]||'';
  if((isDel?(opener[1]||''):following)&&previous&&!isPunct)return null;
  const width=[...opener[0]].length-1;if(!width)return null;
  const closer=isDel?delClose:symbol==='*'?emCloseStar:emCloseUnder;
  const tail=mask.slice(offset+width);let needed=width,skipped=0;
  const total=offset-start+width, constrained=!isDel&&!!before.trim()&&(!!following||symbol==='*'&&!(before==='*'||before==='_'||punct(before)));
  closer.lastIndex=0;let match;
  while((match=closer.exec(tail))) {
    const run=match.slice(1,7).find(Boolean);if(!run)continue;
    let n=[...run].length;if(isDel&&n!==width)continue;
    if(match[3]||match[4]){needed+=n;continue;}
    if(!isDel&&(match[5]||match[6]||constrained)){
      if(same&&(match[5]||match[6]))break;
      if(total%3&&(total+n)%3===0){skipped+=n;continue;}
    }
    needed-=n;if(needed>0)continue;
    n=Math.min(n,n+needed+skipped);
    const length=width+match.index+[...match[0]][0].length+n;
    const amount=isDel?width:Math.min(width,n)%2?1:2;
    return {raw:src.slice(0,length),text:src.slice(amount,length-amount),tag:isDel?'del':amount===1?'em':'strong'};
  }
  return null;
}
// Autolinks do not invalidate an outer link; explicit nested links do.
function hasExplicitLink(src,refs) { const state={};inline(src,refs,true,state);return state.link; }
function inline(src, refs, inLink, state = {}) {
  let out = '', m, previous='';
  const shared=refs[inlineStateKey]||(refs[inlineStateKey]={inLink:false});
  const savedLink=shared.inLink;if(inLink!==undefined)shared.inLink=inLink;
  const mask=maskedInline(src,refs), total=src.length;
  while (src) {
    if ((m = /^\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/.exec(src))) out += escape(m[1]);
    else if ((m = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/.exec(src))) {
      let text = m[2].replace(/\n/g, ' ');
      if (/^ .* $/.test(text) && /[^ ]/.test(text)) text = text.slice(1,-1);
      out += '<code>' + escape(text,true) + '</code>';
    } else if ((m = /^(?: {2,}|\\)\n(?!\s*$)[ \t]*/.exec(src))) out += '<br>';
    else if ((m = linkAt(src,refs)) && (src[0]==='!' || !hasExplicitLink(m[1],refs))) {
      if(src[0]!=='!')state.link=true;
      const href = escape(encodeURI(unescape(m[2])).replace(/%25/g,'%'));
      const title = m[3] == null ? '' : ' title="'+escape(unescape(m[3]))+'"';
      out += src[0] === '!' ? '<img src="'+href+'" alt="'+altText(inline(m[1],refs,true))+'"'+title+'>' : '<a href="'+href+'"'+title+'>'+inline(m[1],refs,true)+'</a>';
    } else if ((m = /^<([a-z][\w+.-]{1,31}:[^\s<>]*)>/i.exec(src))) out += '<a href="'+escape(encodeURI(m[1]).replace(/%25/g,'%'))+'">'+escape(m[1])+'</a>';
    else if ((m = /^<([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.[a-z]+)>/i.exec(src))) out += '<a href="mailto:'+escape(encodeURI(m[1]).replace(/%25/g,'%'))+'">'+escape(m[1])+'</a>';
    else if ((m = inlineTag.exec(src))) {out += m[0];if(/^<a /i.test(m[0]))shared.inLink=true;else if(/^<\/a\s*>/i.test(m[0]))shared.inLink=false;}
    else if (!shared.inLink && (m = /^(?:(?:mailto:|xmpp:)[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?|[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-]))/.exec(src))) {
      if(!m[0].startsWith('xmpp:'))m[0]=m[0].replace(/\/.*$/,'');
      m[0]=m[0].replace(/\.$/,'');out+='<a href="'+escape((/^(?:mailto|xmpp):/.test(m[0])?'':'mailto:')+m[0])+'">'+escape(m[0])+'</a>';
    }
    else if (!shared.inLink && (m = /^(?:(?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)[^\s<>]+/.exec(src))) {
      let last;
      do { last=m[0];m[0]=m[0].match(/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/)?.[0]||''; } while(last!==m[0]);
      out += '<a href="'+escape(encodeURI((m[0].startsWith('www.')?'http://':'')+m[0]).replace(/%25/g,'%'))+'">'+escape(m[0])+'</a>';
    } else if ((m = delimiterSpan(src,mask,previous,total-src.length))) {
      out+='<'+m.tag+'>'+inline(m.text,refs,undefined,state)+'</'+m.tag+'>';m=[m.raw];
    } else if ((m = delimiterSpan(src,mask,previous,total-src.length,true))) {
      out+='<del>'+inline(m.text,refs,undefined,state)+'</del>';m=[m.raw];
    }
    else {
      m = /^[^\\`*_[!<~\n ]+|^ +(?!(?: *\n))|^\n/.exec(src);
      if (!m) m=[src[0]==='`' ? /^`+/.exec(src)[0] : src[0]];
      const stop=m[0].search(/(?:https?:\/\/|ftp:\/\/|www\.|(?:mailto:|xmpp:)?[A-Za-z0-9._+-]+@[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]*[a-zA-Z0-9])+(?![\w-]))/);
      if(stop>0)m[0]=m[0].slice(0,stop);
      out += escape(numericText(m[0]));
      if(!m[0].endsWith('_'))previous=m[0].at(-1);
      src=src.slice(m[0].length);continue;
    }
    previous='';src=src.slice(m[0].length);
  }
  if(inLink!==undefined)shared.inLink=savedLink;return out;
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
const blockTags='address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
function htmlBlock(line, interrupt=false) {
  const t=line.replace(/^ {0,3}/,'');if(t[0]!=='<')return null;
  let m=/^<(script|pre|style|textarea)(?:\s|>|$)/i.exec(t);
  if(m)return {end:new RegExp('</'+m[1]+'>','i')};
  if(t.startsWith('<!--'))return {end:/-->/};
  if(t.startsWith('<?'))return {end:/\?>/};
  if(/^<![A-Z]/.test(t))return {end:/>/};
  if(t.startsWith('<![CDATA['))return {end:/\]\]>/};
  if(new RegExp('^</?(?:'+blockTags+')(?:[ \t\n/>]|$)','i').test(t))return {};
  if(!interrupt){const tag=inlineTag.exec(t);if(tag&&/^ *$/.test(t.slice(tag[0].length)))return {};}
  return null;
}
const starts = s => !!(htmlBlock(s,true)&&!/^ {0,3}<\/(?:pre|script|style|textarea)>/i.test(s)) || /^(?: {0,3}(?:#{1,6}(?:\s|$)|>|`{3,}(?!`)[^`]*$|~{3,}|(?:[-*_][ \t]*){3,}$|(?:[*+-]|1[.)])[ \t]+)| {0,3}<\/?(?:div|table|section|ul|ol|li|p|h[1-6])\b)/i.test(s);
function expandIndent(line, force=false) {
  if(!force&&/^ {4}/.test(line))return line;
  return line.replace(force?/^[ \t]*/:/^[ \t]*(?:(?:[*+-]|\d+[.)])[ \t]+)?/,prefix=>{let col=0;return prefix.replace(/[^\t]|\t/g,c=>{const n=c==='\t'?4-col%4:1;col+=n;return c==='\t'?' '.repeat(n):c;});});
}
function lazyText(line){return line.replace(/^ {4}/,'').replace(/^( {0,3})([*+\-])(?=[ \t]|$)/,'$1\\$2');}
function blocks(lines, refs, tight=false, collecting=false, meta=null, nested=false) {
  const renderInline=collecting ? () => '' : inline;
  let out='';
  for(let i=0;i<lines.length;) {
    let line=expandIndent(lines[i]),m;
    if(!line.trim()){let j=i;while(j<lines.length&&!lines[j].trim())j++;if(meta&&i>0&&j<lines.length)meta.loose=true;i=j;continue;}
    const def=definitionAt(lines,i);if(def){if(!(def.key in refs))refs[def.key]={href:def.href,title:def.title};i+=def.count;continue;}
    if((m=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)) && !(m[1][0]==='`' && m[2].includes('`'))) {
      const fence=m[1], lang=unescape(m[2].trim()).split(/\s/)[0]; let body=[]; i++;
      const close=new RegExp('^ {0,3}'+fence[0]+'{'+fence.length+',} *$');
      while(i<lines.length && !close.test(lines[i]))body.push(lines[i++].replace(/^[ \t]+/,ws=>fence[0]==='`'?ws.slice(Math.min(ws.length,line.match(/^ */)[0].length)):ws));
      const closed=i<lines.length;if(closed)i++;
      out+='<pre><code'+(lang?' class="language-'+escape(lang)+'"':'')+'>'+escape(body.join('\n')+(body.length&&body.at(-1)!==''?'\n':''),true)+'</code></pre>\n';continue;
    }
    if(/^(?: {4}| {0,3}\t)/.test(line)) {
      let body=[];while(i<lines.length && (/^(?: {4}| {0,3}\t)/.test(lines[i])||!lines[i].trim()))body.push(lines[i++].replace(/^ {0,3}$/,'').replace(/^(?: {4}| {0,3}\t)/,''));
      out+='<pre><code>'+escape(body.join('\n').replace(/\n+$/,'')+'\n',true)+'</code></pre>\n';continue;
    }
    if((m=/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/.exec(line))){out+='<h'+m[1].length+'>'+renderInline((m[2]||'').replace(/^[ \t]+|[ \t]+$/g,'').replace(/(?:^|[ \t]+)#+[ \t]*$/,''),refs)+'</h'+m[1].length+'>\n';i++;continue;}
    if(/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)){out+='<hr>\n';i++;continue;}
    if(/^ {0,3}>/.test(line)) {
      let body=[], lazy=false, quoteFence=null, quoteFenceDepth=0;
      while(i<lines.length&&lines[i].trim()){
        if(/^ {0,3}>/.test(lines[i])) {
          const text=lines[i++].replace(/^( {0,3}>)([ \t]+)/,(_,marker,ws)=>{let col=marker.length;return marker+ws.replace(/[ \t]/g,c=>{const n=c==='\t'?4-col%4:1;col+=n;return ' '.repeat(n);});}).replace(/^ {0,3}> ?/,'');body.push(text);
          const depth=(text.match(/^(?: {0,3}>[ \t]?)+/)?.[0].match(/>/g)||[]).length;
          if(quoteFence&&depth<quoteFenceDepth)quoteFence=null;
          const leaf=text.replace(/^(?: {0,3}>[ \t]?)+/,'').replace(/^ {0,3}(?:[*+-]|\d+[.)]) +/,'').replace(/^(?: {0,3}>[ \t]?)+/,'');
          let fence=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(leaf);if(fence&&fence[1][0]==='`'&&fence[2].includes('`'))fence=null;
          if(quoteFence){if(fence&&fence[1][0]===quoteFence[0]&&fence[1].length>=quoteFence.length)quoteFence=null;lazy=false;}
          else if(fence){quoteFence=fence[1];quoteFenceDepth=depth;lazy=false;}
          else lazy=!!leaf.trim()&&!starts(leaf)&&!/^ {4}/.test(leaf);
        } else {
          if(!lazy||starts(lines[i]))break;
          let text=lazyText(lines[i++]);
          if(/^ {4}/.test(lines[i-1])&&i<lines.length&&lines[i].trim())text+='\n';
          if(/^ {0,3}(?:=+|-+)[ \t]*$/.test(text))text='    '+text;
          body.push(text);
        }
      }
      let html=blocks(body,refs,false,collecting);
      if(body.at(-1)===' ')html=html.replace(/<\/p>\n$/,'\n </p>\n');
      out+='<blockquote>\n'+html+'</blockquote>\n';continue;
    }
    if((m=/^ {0,3}([*+-]|\d{1,9}[.)])(?:[ \t]+(.*)|$)/.exec(line))) {
      const ordered=/\d/.test(m[1]), marker=ordered?m[1].slice(-1):m[1],tag=ordered?'ol':'ul'; let items=[],loose=false;
      while(i<lines.length){lines[i]=expandIndent(lines[i]);const match=/^( {0,3})([*+-]|\d{1,9}[.)])(?:([ \t]+)(.*)|$)/.exec(lines[i]);if(/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(lines[i]))break;if(!match || (/\d/.test(match[2])!==ordered) || (ordered?match[2].slice(-1):match[2])!==marker)break;
        const gap=match[4]?match[3]?.length||1:1, padding=gap>4?1:gap;
        let indent=match[1].length+match[2].length+padding,body=[' '.repeat(gap-padding)+(match[4]||'')];i++;
        let blank=false;
        while(i<lines.length){
          if(!lines[i].trim()){
            let j=i;while(j<lines.length&&!lines[j].trim())j++;
            if(j===lines.length)break;
            const next=lines[j]=expandIndent(lines[j],true), lead=next.match(/^ */)[0].length;
            const sibling=/^ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]+|$)/.test(next);
            if(lead>=indent&&body.some(x=>x.trim())){body.push(...Array(j-i).fill(''));i=j;blank=true;continue;}
            if(sibling){const nm=/^ {0,3}([*+-]|\d{1,9}[.)])/.exec(next)[1];if((ordered?/\d/.test(nm)&&nm.at(-1)===marker:nm===marker)&&!/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(next)){loose=true;body.push('');}i=j;}break;
          }
          lines[i]=expandIndent(lines[i],true);
          if(new RegExp('^ {0,'+(indent-1)+'}(?:`{3,}|~{3,})').test(lines[i]))break;
          if(new RegExp('^ {'+indent+'}').test(lines[i])){body.push(lines[i++].slice(indent));blank=false;}
          else if(!blank&&body[0].trim()&&!/^ {4}|^ {0,3}(?:`{3,}|~{3,}|#{1,6}(?: |$)|(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$)/.test(body.at(-1))&&!htmlBlock(body.at(-1),true)&&!starts(lines[i])&&!/^ {0,3}(?:[*+-]|\d+[.)])(?: |$)/.test(lines[i]))body.push(lazyText(lines[i++]));
          else break;
        }
        items.push(body);
      }
      for(const body of items){const state={};blocks(body,refs,false,true,state,true);if(state.loose)loose=true;}
      out+='<'+tag+(ordered&&parseInt(m[1])!==1?' start="'+parseInt(m[1])+'"':'')+'>\n';
      for(const body of items){
        // Keep the task marker during block parsing: removing it early can expose
        // HTML, headings, or other syntax that was originally paragraph text.
        const task=/^\[([ xX])\] +/.exec(body[0]);
        let html=blocks(body,refs,!loose,collecting,null,true);
        if(task)html=html.replace(/^(<p>)?\[[ xX]\] +/,(_,p)=>(p||'')+'<input '+(task[1]!==' '?'checked="" ':'')+'disabled="" type="checkbox"> ');
        out+='<li>'+html+'</li>\n';
      }
      out+='</'+tag+'>\n';continue;
    }
    const html=htmlBlock(line);
    if(html) {
      let body=[];
      do {body.push(lines[i++]);if(html.end&&html.end.test(body.at(-1)))break;} while(i<lines.length && (html.end || lines[i].trim()));
      out+=body.join('\n')+(i<lines.length&&((html.end?lines[i].length:lines[i].trim())||i===lines.length-1)?'\n':'');continue;
    }
    if(i+1<lines.length && (line.includes('|')||lines[i+1].includes('|')) && /^ {0,3}\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/.test(lines[i+1]) && lines[i+1].includes('-')) {
      const cells = row => row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
      const headers=cells(line),align=cells(lines[i+1]);
      if(headers.length===align.length){
        const attrs=align.map(x=>x.startsWith(':')?(x.endsWith(':')?' align="center"':' align="left"'):(x.endsWith(':')?' align="right"':''));
        const row=(values,tag)=>'<tr>\n'+headers.map((_,j)=>'<'+tag+attrs[j]+'>'+renderInline(values[j]||'',refs)+'</'+tag+'>\n').join('')+'</tr>\n';
        out+='<table>\n<thead>\n'+row(headers,'th')+'</thead>\n';i+=2;let rows='';
        while(i<lines.length&&!/^ *$/.test(lines[i])&&!starts(lines[i])&&!/^(?: {4}| {0,3}\t)[^\n]/.test(lines[i]))rows+=row(cells(lines[i++]),'td');
        if(rows)out+='<tbody>'+rows+'</tbody>';out+='</table>\n';continue;
      }
    }
    let body=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!starts(lines[i])&&!(nested&&/^ {0,3}\d{1,9}[.)](?:[ \t]+|$)/.test(lines[i]))){if(/^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i]))break;if(nested&&/^ {4}/.test(lines[i])){
        // marked merges indented code into an existing paragraph, retaining
        // the code token's final newline before the next text/block token.
        let code=[];while(i<lines.length&&/^ {4}/.test(lines[i]))code.push(lines[i++].slice(4));
        body.push(code.join('\n')+'\n');
      }else body.push(lines[i++]);}
    if(i<lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])){const level=lines[i++].trim()[0]==='='?1:2;out+='<h'+level+'>'+renderInline(body.join('\n').trim(),refs)+'</h'+level+'>\n';}
    else out+=(tight?'':'<p>')+renderInline(body.join('\n'),refs)+(tight?'':'</p>\n');
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
