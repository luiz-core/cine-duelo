const test = require('node:test');
const assert = require('node:assert/strict');
const {createTournament, getCurrentMatch, finishMatch} = require('../tournament.js');
for (const n of [2, 3, 5, 8, 13, 16]) {
  test(`eliminações e campeão com ${n} filmes`, () => {
    const films = Array.from({length:n}, (_, i) => ({id:String(i)}));
    const state = createTournament(films, () => 0.5);
    const eliminated = new Set();
    let count = 0;
    while (getCurrentMatch(state)) {
      const match = getCurrentMatch(state);
      assert.notEqual(match.a, match.b);
      assert.ok(!eliminated.has(match.a) && !eliminated.has(match.b));
      assert.throws(() => finishMatch(state, match.id, 0, 0));
      assert.throws(() => finishMatch(state, match.id, -1, 1));
      assert.throws(() => finishMatch(state, match.id, 1.5, 1));
      eliminated.add(match.b);
      finishMatch(state, match.id, 2, 1);
      assert.throws(() => finishMatch(state, match.id, 2, 1));
      assert.ok(++count <= n - 1);
    }
    assert.equal(count, n - 1);
    assert.ok(films.some(f => f.id === state.championId));
    assert.ok(!eliminated.has(state.championId));
    const ids = state.rounds[0].flatMap(m => [m.a, m.b]).filter(x => x !== null);
    assert.equal(ids.length, n);
    assert.equal(new Set(ids).size, n);
  });
}
test('rejeita cadastro insuficiente ou duplicado', () => {
  assert.throws(() => createTournament([]));
  assert.throws(() => createTournament([{id:'a'}, {id:'a'}]));
});
test('vencedor do lado B e retomada JSON', () => {
  let state = createTournament([{id:'a'}, {id:'b'}, {id:'c'}], () => .99);
  let m = getCurrentMatch(state);
  finishMatch(state, m.id, 0, 3);
  state = JSON.parse(JSON.stringify(state));
  m = getCurrentMatch(state);
  const winner = m.b;
  finishMatch(state, m.id, 2, 4);
  assert.equal(state.championId, winner);
});
