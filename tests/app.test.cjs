const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../tournament.js');
// Exercise the real controller and persistence with a small DOM boundary adapter.
// This does not replace visual/browser verification.
function boot(raw, options = {}) {
  const ids = new Map();
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.files = []; this.hidden = false; this.style = {}; this.textContent = ''; }
    set id(value) { this._id = value; ids.set(value,this); } get id() { return this._id; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name,fn) { this.listeners[name] = fn; }
    setAttribute(name,value) { this[name] = value; }
    focus() {} reset() {} showModal() {} close() {}
    click() { if (!this.disabled) (this.onclick || this.listeners.click)?.({target:this}); }
  }
  const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for (const [,id] of html.matchAll(/id="([^"]+)"/g)) { const el = new Element('div'); el.id = id; }
  let stored = raw;
  const context = {document:{getElementById:id=>ids.get(id),createElement:tag=>new Element(tag)},CineTournament:engine,CINE_MOVIES:options.movies || [],
    localStorage:{getItem:()=>stored,setItem:(_,value)=>{if(options.failSave)throw Error('quota');stored=value;}},
    Image:class extends Element{constructor(){super('img');}}, window:{scrollTo(){}},matchMedia:()=>({matches:true}),confirm:()=>true,setTimeout:()=>0,console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
  function find(root,text) { return root.children.flatMap(c => [c, ...descend(c)]).find(n => n.tagName === 'button' && n.textContent === text); }
  function descend(root) { return root.children.flatMap(c=>[c,...descend(c)]); }
  return {ids,get:id=>ids.get(id),stored:()=>stored,state:()=>JSON.parse(stored),
    add(name,url='') { ids.get('film-name').value=name;ids.get('film-url').value=url;ids.get('film-form').listeners.submit({preventDefault(){}}); },
    click(text) { const el=find(ids.get('arena'),text)||find(ids.get('champion'),text); assert.ok(el,`Button ${text} exists`);el.click(); },
    vote() { const b=descend(ids.get('arena')).find(e=>e['aria-label']?.startsWith('Votar em'));assert.ok(b);b.click(); }
  };
}
test('controller completes three-film tournament, survives reload and rejects ties',()=>{
  let app=boot(); app.add('A');app.add('B');app.add('C');app.get('start-button').click();
  app.click('Encerrar duelo →');assert.equal(app.state().screen,'arena');assert.match(app.get('notice').textContent,/Empatou/);
  app.vote();app=boot(app.stored());assert.equal(app.state().draftScores[0],1);
  app.click('Encerrar duelo →');assert.equal(app.state().screen,'result');
  app=boot(app.stored());assert.equal(app.get('arena').hidden,false);
  app.click('Próximo duelo →');app.vote();app.click('Encerrar duelo →');app.click('Revelar campeão ✦');
  assert.equal(app.state().screen,'champion');assert.ok(app.state().tournament.championId);
  app=boot(app.stored());assert.equal(app.get('champion').hidden,false);
  app.click('Nova disputa com estes filmes');assert.equal(app.state().screen,'champion');app.get('confirm-reset').click();assert.equal(app.state().screen,'setup');assert.equal(app.state().films.length,3);
});
test('corrupted storage recovers to working setup',()=>{
  for(const raw of ['invalid', '{}', JSON.stringify({version:1,films:[null],screen:'setup'})]) {
    const app=boot(raw);assert.equal(app.get('setup').hidden,false);app.add('New');assert.equal(app.state().films.length,1);
  }
});
test('quota failure warns but registration remains usable',()=>{
  const app=boot(null,{failSave:true});app.add('A');app.add('B');assert.equal(app.get('start-button').disabled,false);assert.match(app.get('notice').textContent,/Não foi possível salvar/);app.get('start-button').click();assert.equal(app.get('arena').hidden,false);
});
test('HTML-looking names are preserved literally and non-http poster rejected',()=>{
  const app=boot();app.add('<img onerror=alert(1)>');assert.equal(app.state().films[0].name,'<img onerror=alert(1)>');
  app.add('Unsafe','javascript:alert(1)');assert.equal(app.state().films.length,1);assert.match(app.get('notice').textContent,/http/);
});
test('curated list loads once and import does not duplicate or discard existing films',()=>{
  const movies=[{id:'night-1',name:'The Terminal',poster:''},{id:'night-2',name:'Bambi',poster:''}];
  let app=boot(null,{movies});
  assert.equal(app.get('film-count').textContent,2);
  app.get('load-list-button').click();
  assert.deepEqual(app.state().films.map(f=>f.name),['The Terminal','Bambi']);
  app.add('My pick');app.get('load-list-button').click();assert.equal(app.state().films.length,3);
  app=boot(app.stored(),{movies});assert.equal(app.get('film-count').textContent,3);
});
test('manual names cannot be added twice with case or accent differences',()=>{
  const app=boot();app.add('Amélie');app.add('  AMELIE ');
  assert.equal(app.state().films.length,1);
});
test('import fills missing posters without replacing a custom poster',()=>{
  let app=boot();app.add('The Terminal');app.add('Bambi','https://example.com/my-poster.jpg');
  app=boot(app.stored(),{movies:[{id:'night-1',name:'The Terminal',poster:'https://example.com/terminal.jpg'},{id:'night-2',name:'Bambi',poster:'https://example.com/bambi.jpg'}]});
  app.get('load-list-button').click();
  assert.equal(app.state().films[0].poster,'https://example.com/terminal.jpg');
  assert.equal(app.state().films[1].poster,'https://example.com/my-poster.jpg');
});
