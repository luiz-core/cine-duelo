// Optional loopback preview: exposes only the five public application files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const files = {'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/tournament.js':'tournament.js','/movies.js':'movies.js','/app.js':'app.js'};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{
  const file=files[new URL(req.url,'http://127.0.0.1').pathname];
  if (!file || !['GET','HEAD'].includes(req.method)) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(path.join(root,file)).pipe(res);
}).listen(4173,'127.0.0.1',()=>console.log('Cine Duelo: http://127.0.0.1:4173'));
