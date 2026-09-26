(function (root) {
  'use strict';
  function createTournament(films, random = Math.random) {
    if (!Array.isArray(films) || films.length < 2 || films.some(f => typeof f.id !== 'string' || !f.id) || new Set(films.map(f => f.id)).size !== films.length) throw new Error('Adicione pelo menos dois filmes diferentes.');
    const ids = films.map(f => f.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const size = 2 ** Math.ceil(Math.log2(ids.length));
    const rounds = [];
    for (let count = size / 2, r = 0; count >= 1; count /= 2, r++) {
      rounds.push(Array.from({length:count}, (_, i) => ({id:`${r}-${i}`, a:null, b:null, scoreA:0, scoreB:0, winnerId:null, automatic:false})));
    }
    const state = {rounds, championId:null};
    const byes = size - ids.length;
    let cursor = 0;
    rounds[0].forEach((m, i) => {
      m.a = ids[cursor++];
      if (i < byes) { m.automatic = true; advance(state, 0, i, m.a); }
      else m.b = ids[cursor++];
    });
    return state;
  }
  function advance(state, r, i, winner) {
    state.rounds[r][i].winnerId = winner;
    if (r === state.rounds.length - 1) state.championId = winner;
    else state.rounds[r + 1][Math.floor(i / 2)][i % 2 === 0 ? 'a' : 'b'] = winner;
  }
  function getCurrentMatch(state) {
    return state.rounds.flat().find(m => m.a !== null && m.b !== null && m.winnerId === null) || null;
  }
  function finishMatch(state, matchId, scoreA, scoreB) {
    const m = getCurrentMatch(state);
    if (!m || m.id !== matchId) throw new Error('Este duelo já terminou ou ainda não começou.');
    if (![scoreA, scoreB].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Os votos precisam ser números inteiros positivos ou zero.');
    if (scoreA === scoreB) throw new Error('Empatou! Mais um voto para desempatar.');
    m.scoreA = scoreA; m.scoreB = scoreB;
    const [r, i] = m.id.split('-').map(Number);
    advance(state, r, i, scoreA > scoreB ? m.a : m.b);
    return state;
  }
  const api = {createTournament, getCurrentMatch, finishMatch};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CineTournament = api;
})(globalThis);
