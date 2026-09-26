(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = CineTournament;
  const KEY = 'cine-duelo-v1';
  const movieKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const defaults = () => (globalThis.CINE_MOVIES || []).map(f => ({...f}));
  const fresh = () => ({version:1, films:[], tournament:null, screen:'setup', draftScores:[0,0], lastWinnerId:null, lastMatchId:null});
  let state = fresh();
  let pendingPoster = '', uploadBusy = false, uploadVersion = 0;
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { notice('Não foi possível salvar neste navegador. Mantenha esta página aberta para não perder a sessão.'); }
  }
  function safePoster(value) {
    if (typeof value !== 'string') return false;
    return !value || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || /^https?:\/\//i.test(value);
  }
  function validate(saved) {
    if (!saved || saved.version !== 1 || !Array.isArray(saved.films) || !['setup','arena','result','champion'].includes(saved.screen)) throw Error();
    if (saved.films.some(f => !f || typeof f.id !== 'string' || !f.id || typeof f.name !== 'string' || !f.name.trim() || !safePoster(f.poster))) throw Error();
    if (new Set(saved.films.map(f => f.id)).size !== saved.films.length || !Array.isArray(saved.draftScores) || saved.draftScores.length !== 2 || !saved.draftScores.every(n => Number.isSafeInteger(n) && n >= 0)) throw Error();
    if (saved.screen === 'setup') { if (saved.tournament !== null) throw Error(); return saved; }
    const t = saved.tournament;
    if (!t || !Array.isArray(t.rounds) || !Array.isArray(t.rounds[0])) throw Error();
    const order = t.rounds[0].flatMap(m => [m.a,m.b]).filter(id => id !== null);
    if (order.length !== saved.films.length || new Set(order).size !== order.length || order.some(id => !saved.films.some(f => f.id === id))) throw Error();
    const replay = engine.createTournament(order.map(id => ({id})), () => .999999);
    if (t.rounds.length !== replay.rounds.length) throw Error();
    for (let r = 0; r < replay.rounds.length; r++) {
      if (!Array.isArray(t.rounds[r]) || t.rounds[r].length !== replay.rounds[r].length) throw Error();
      for (let i = 0; i < replay.rounds[r].length; i++) {
        const input = t.rounds[r][i], match = replay.rounds[r][i];
        if (!input || input.id !== match.id || input.a !== match.a || input.b !== match.b || input.automatic !== match.automatic) throw Error();
        if (!match.automatic && input.winnerId !== null) engine.finishMatch(replay, match.id, input.scoreA, input.scoreB);
        if (input.winnerId !== match.winnerId || input.scoreA !== match.scoreA || input.scoreB !== match.scoreB) throw Error();
      }
    }
    if (t.championId !== replay.championId) throw Error();
    const completed = t.rounds.flat().filter(m => m.winnerId !== null && !m.automatic);
    if (saved.screen === 'result' && (!completed.length || completed.at(-1).id !== saved.lastMatchId || completed.at(-1).winnerId !== saved.lastWinnerId)) throw Error();
    if (saved.screen === 'champion' && !t.championId) throw Error();
    if (saved.screen === 'arena' && !engine.getCurrentMatch(t)) throw Error();
    return saved;
  }
  try { const raw = localStorage.getItem(KEY); if (raw) state = validate(JSON.parse(raw)); else state.films = defaults(); }
  catch { notice('Não foi possível recuperar a sessão anterior. Você pode montar uma nova disputa.'); }
  function poster(film) {
    const box = node('div','poster');
    const fallback = () => {
      const p = node('div','poster-fallback');
      p.append(node('span','','✦'), node('strong','',film.name), node('small','','CINE DUELO · SELEÇÃO DA NOITE'));
      box.replaceChildren(p);
    };
    if (!film.poster) fallback();
    else { const img = new Image(); img.alt = `Capa de ${film.name}`; img.addEventListener('error', fallback, {once:true}); img.src = film.poster; box.append(img); }
    return box;
  }
  const filmById = id => state.films.find(f => f.id === id);
  function button(text, cls, action) { const b = node('button',`button ${cls}`,text); b.type = 'button'; b.addEventListener('click',action); return b; }
  function roundLabel(r) { const left = state.tournament.rounds.length - r; return left === 1 ? 'Grande final' : left === 2 ? 'Semifinais' : left === 3 ? 'Quartas de final' : `Rodada ${r+1}`; }
  function renderSetup() {
    $('film-count').textContent = state.films.length;
    const list = $('film-list'); list.replaceChildren();
    if (!state.films.length) {
      const empty = node('div','empty-state');
      empty.append(node('div','empty-icon','▶'),node('h3','','O próximo favorito pode ser o seu.'),node('p','','Adicione pelo menos 2 filmes ao lado.\nDepois, deixe a disputa começar.'));
      list.append(empty);
    }
    state.films.forEach(film => {
      const card = node('article','film-item');
      const remove = node('button','remove','×'); remove.setAttribute('aria-label',`Remover ${film.name}`);
      remove.onclick = () => { state.films = state.films.filter(f => f.id !== film.id); save(); renderSetup(); };
      card.append(poster(film),node('h3','',film.name),remove); list.append(card);
    });
    $('start-button').disabled = state.films.length < 2 || uploadBusy;
    $('start-hint').textContent = state.films.length < 2 ? 'A noite começa com 2 filmes' : `${state.films.length} filmes. Só um ganha o play.`;
  }
  function setPreview(src) { $('preview').hidden = !src; $('preview').replaceChildren(); if (src) $('preview').append(poster({name:$('film-name').value.trim() || 'Prévia',poster:src})); }
  $('film-url').addEventListener('change', () => { if (!pendingPoster) setPreview(/^https?:\/\//i.test($('film-url').value) ? $('film-url').value : ''); });
  $('film-file').addEventListener('change', async () => {
    const version = ++uploadVersion;
    const file = $('film-file').files[0]; pendingPoster = ''; setPreview('');
    if (!file) { uploadBusy = false; $('add-button').disabled = false; $('file-label').textContent = 'Escolher uma imagem'; renderSetup(); return; }
    uploadBusy = true; $('add-button').disabled = true; renderSetup();
    let url;
    try {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 15 MB.');
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 600 / Math.max(img.width,img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(img.width*scale)); canvas.height = Math.max(1,Math.round(img.height*scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#19171f'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
      if (version !== uploadVersion) return;
      pendingPoster = canvas.toDataURL('image/jpeg',.82); $('file-label').textContent = file.name; setPreview(pendingPoster);
    } catch (e) { if (version === uploadVersion) { notice(e.message || 'Esta imagem não pôde ser aberta.'); $('film-file').value = ''; $('file-label').textContent = 'Escolher uma imagem'; } }
    finally { if (url) URL.revokeObjectURL(url); if (version === uploadVersion) { uploadBusy = false; $('add-button').disabled = false; renderSetup(); } }
  });
  $('film-form').addEventListener('submit', event => {
    event.preventDefault(); if (uploadBusy) return;
    const name = $('film-name').value.trim(), url = $('film-url').value.trim();
    if (!name) { notice('Dê um nome ao filme antes de adicionar.'); return; }
    if (state.films.some(f => movieKey(f.name) === movieKey(name))) { notice('Esse filme já está na disputa.'); return; }
    if (!pendingPoster && url && !/^https?:\/\//i.test(url)) { notice('Use um link de imagem que comece com http:// ou https://.'); return; }
    notice('');
    state.films.push({id:globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,name,poster:pendingPoster || url});
    save(); $('film-form').reset(); pendingPoster = ''; $('file-label').textContent = 'Escolher uma imagem'; setPreview(''); renderSetup(); $('film-name').focus();
  });
  $('load-list-button').onclick = () => {
    if (state.screen !== 'setup') return;
    const names = new Set(state.films.map(f => movieKey(f.name)));
    let count = 0;
    defaults().forEach(f => {
      const existing = state.films.find(old => movieKey(old.name) === movieKey(f.name));
      if (existing && !existing.poster && f.poster) { existing.poster = f.poster; existing.source = f.source; }
      if (!names.has(movieKey(f.name))) {
        if (state.films.some(old => old.id === f.id)) f.id += `-${Date.now()}`;
        state.films.push(f); names.add(movieKey(f.name)); count++;
      }
    });
    notice(count ? `${count} filmes adicionados da sua lista.` : 'Sua lista já está carregada, sem repetições.'); save(); renderSetup();
  };
  $('start-button').onclick = () => {
    if (uploadBusy || state.films.length < 2) return;
    notice(''); state.tournament = engine.createTournament(state.films); state.screen = 'arena'; state.draftScores = [0,0]; state.lastMatchId = null; state.lastWinnerId = null; save(); render(); window.scrollTo(0,0);
  };
  function renderArena() {
    const area = $('arena'); area.replaceChildren();
    const result = state.screen === 'result';
    const match = result ? state.tournament.rounds.flat().find(m => m.id === state.lastMatchId) : engine.getCurrentMatch(state.tournament);
    const r = Number(match.id.split('-')[0]);
    const heading = node('div','arena-heading');
    heading.append(node('p','eyebrow',`${roundLabel(r)} · ${result ? 'RESULTADO DO DUELO' : 'É HORA DE ESCOLHER'}`),node('h1','',result ? 'Um passo mais perto do play.' : 'Qual merece a sua noite?'),node('p','',result ? 'O favorito de alguém acabou de ficar pelo caminho.' : 'A galera escolhe. Você registra os votos aqui.'));
    const grid = node('div','duel-grid');
    [match.a,match.b].forEach((id,index) => {
      if (index) grid.append(node('div','vs','VS'));
      const film = filmById(id), card = node('article',`contender${result ? id === match.winnerId ? ' winner' : ' loser' : ''}`);
      card.append(poster(film),node('h2','',film.name));
      const controls = node('div','vote-controls');
      const minus = button('−','',() => vote(index,-1)); minus.setAttribute('aria-label',`Retirar voto de ${film.name}`);
      const score = node('output','',String(result ? index === 0 ? match.scoreA : match.scoreB : state.draftScores[index])); score.id = `score-${index}`; score.setAttribute('aria-label',`Votos de ${film.name}`);
      const plus = button('+','',() => vote(index,1)); plus.setAttribute('aria-label',`Votar em ${film.name}`);
      minus.id = `minus-${index}`; minus.disabled = result || state.draftScores[index] === 0; plus.disabled = result;
      controls.append(minus,score,plus); card.append(controls,node('p',`vote-label${result && id === match.winnerId ? ' result-label' : ''}`,result && id === match.winnerId ? '✦ CLASSIFICADO' : 'VOTOS')); grid.append(card);
    });
    const bottom = node('div','arena-bottom');
    if (result) bottom.append(button(state.tournament.championId ? 'Revelar campeão ✦' : 'Próximo duelo →','primary',() => { state.screen = state.tournament.championId ? 'champion' : 'arena'; state.draftScores = [0,0]; save(); render(); if (state.screen === 'champion') celebrate(); }));
    else bottom.append(button('Encerrar duelo →','primary',() => {
      if (state.screen !== 'arena') return;
      try { engine.finishMatch(state.tournament,match.id,...state.draftScores); }
      catch(e) { notice(e.message); return; }
      notice(''); state.lastWinnerId = match.winnerId; state.lastMatchId = match.id; state.screen = 'result'; save(); render();
    }));
    const played = state.tournament.rounds.flat().filter(m => m.winnerId !== null && !m.automatic).length;
    bottom.append(node('p','',`${played} de ${state.films.length-1} duelos decididos`));
    const track = node('div','progress-track'), fill = node('span'); fill.style.width = `${100*played/(state.films.length-1)}%`; track.append(fill); bottom.append(track);
    const reset = button('Voltar à seleção de filmes','reset-link',() => resetTournament(false)); bottom.append(reset); area.append(heading,grid,bottom);
  }
  function vote(index,delta) {
    if (state.screen !== 'arena') return;
    state.draftScores[index] = Math.max(0,Math.min(9999,state.draftScores[index]+delta));
    $(`score-${index}`).textContent = state.draftScores[index]; $(`minus-${index}`).disabled = state.draftScores[index] === 0; save();
  }
  let resetChoice = null;
  function resetTournament(clear) {
    resetChoice = clear;
    $('reset-description').textContent = clear ? 'Todos os filmes e o resultado desta sessão serão removidos.' : 'O progresso do torneio será apagado. Seus filmes ficam para uma nova votação.';
    $('reset-dialog').showModal();
  }
  $('cancel-reset').onclick = () => { resetChoice = null; $('reset-dialog').close(); };
  $('reset-dialog').addEventListener('cancel', () => { resetChoice = null; });
  $('confirm-reset').onclick = () => {
    if (resetChoice === null) return;
    const films = resetChoice ? [] : state.films; resetChoice = null;
    state = fresh(); state.films = films; $('reset-dialog').close(); notice(''); save(); render(); window.scrollTo(0,0);
  };
  function renderChampion() {
    const winner = filmById(state.tournament.championId), wrap = node('div','champion-wrap');
    wrap.append(node('p','eyebrow gold','✦ TEMOS O CAMPEÃO DA NOITE ✦'),node('h1','','Hoje a sessão é esse!'),node('p','','A democracia falou. Agora é preparar a pipoca.'),poster(winner),node('h2','',winner.name),node('p','',`Entre ${state.films.length} filmes, este conquistou o sofá.`));
    const actions = node('div','champion-actions'); actions.append(button('Nova disputa com estes filmes','primary',() => resetTournament(false)),button('Limpar e começar do zero','secondary',() => resetTournament(true))); wrap.append(actions); $('champion').replaceChildren(wrap);
  }
  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = $('confetti'); host.replaceChildren();
    for (let i=0;i<55;i++) { const bit=node('i','confetti-piece'); bit.style.left=`${Math.random()*100}%`; bit.style.background=['#aa8aff','#eac477','#f4efff'][i%3]; bit.style.animationDelay=`${Math.random()*.7}s`; host.append(bit); }
    setTimeout(() => host.replaceChildren(),4000);
  }
  function render() {
    $('setup').hidden = state.screen !== 'setup'; $('arena').hidden = !['arena','result'].includes(state.screen); $('champion').hidden = state.screen !== 'champion'; $('bracket-button').hidden = !state.tournament;
    if (state.screen === 'setup') renderSetup(); else if (state.screen === 'champion') renderChampion(); else renderArena();
  }
  $('bracket-button').onclick = () => {
    const host = $('bracket-content'); host.replaceChildren();
    state.tournament.rounds.forEach((round,r) => {
      const col = node('section','bracket-round'); col.append(node('h3','',roundLabel(r)));
      round.forEach(m => {
        const block=node('div','bracket-match');
        [m.a,m.b].forEach((id,i) => { const row=node('div',`bracket-team${id && id===m.winnerId ? ' won' : ''}`); row.append(node('span','',id ? filmById(id).name : m.automatic ? 'Avanço automático' : 'A definir'),node('b','',m.winnerId && !m.automatic ? String(i===0?m.scoreA:m.scoreB) : id && id===m.winnerId ? '✓' : '')); block.append(row); });
        if (m.automatic) block.append(node('div','bracket-note','Classificado por sorteio')); col.append(block);
      }); host.append(col);
    }); $('bracket-dialog').showModal();
  };
  $('close-bracket').onclick = () => $('bracket-dialog').close();
  $('bracket-dialog').addEventListener('click',e => { if (e.target === $('bracket-dialog')) { const rect=e.target.getBoundingClientRect(); if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close(); } });
  render();
})();
