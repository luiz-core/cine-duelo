// Development-only metadata import. The application needs no network API or key.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const movies = JSON.parse(await fs.readFile(path.join(root,'movies.json'),'utf8'));
  const vm = require('node:vm');
  const cached = {};
  try { vm.runInNewContext(await fs.readFile(path.join(root,'movies.js'),'utf8'),cached); } catch {}
  const result = [];
  for (let offset=0;offset<movies.length;offset++) {
    const batch = await Promise.all(movies.slice(offset,offset+1).map(async (movie,index) => {
      const film = {id:`night-${offset+index+1}`,name:movie.name,poster:'',source:''};
      const existing = cached.CINE_MOVIES?.find(f => f.name === movie.name && f.poster);
      if (existing) return {...existing,id:film.id};
      if (!movie.page) return film;
      try {
        await new Promise(resolve => setTimeout(resolve,4500));
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(movie.page)}`,{signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const data = await response.json();
        film.poster = (data.thumbnail?.source || '').split('?')[0];
        film.source = data.content_urls?.desktop?.page || '';
        console.log(`${movie.name}: ${data.title} — ${film.poster ? 'poster found' : 'no poster'}`);
      } catch(e) { console.log(`${movie.name}: ${e.message}`); }
      return film;
    }));
    result.push(...batch);
  }
  await fs.writeFile(path.join(root,'movies.js'),`// Curated movie list. Poster metadata from Wikipedia; sources recorded per film.\nglobalThis.CINE_MOVIES = ${JSON.stringify(result,null,2)};\n`);
  await fs.writeFile(path.join(root,'filmes-para-depois.txt'),result.map(f=>f.name).join('\n')+'\n');
  console.log(`${result.length} films, ${result.filter(f=>f.poster).length} posters`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
