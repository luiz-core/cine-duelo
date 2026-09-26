# Cine Duelo

Abra `index.html` no Chrome, Edge ou Firefox. Não precisa instalar nada.

A lista enviada já vem carregada: 43 entradas, sem repetir The Terminal, com títulos normalizados em inglês e 40 capas por link. Se uma sessão antiga estiver salva, use **Carregar minha lista de filmes** na tela inicial; não duplica nomes e completa capas ausentes sem substituir as suas.

Três entradas foram preservadas por dependerem de identificação: **Chocolate Fabric**, **Monty Python** e **Almost Everything You Ever Wanted to Know About Everything Everywhere All at Once**. Elas continuam disponíveis com pôster tipográfico. O último título corresponde a um extra de bastidores, por isso não foi fundido automaticamente com o longa.

Capas e títulos consultados na Wikipédia, com URL de origem registrada por filme em `movies.js`. Referência do extra de bastidores: https://shop.terracottadistribution.com/products/everything-everywhere-all-at-once-blu-ray-slipcase-version

Prévia opcional com Node.js: execute `node tools/serve.cjs` nesta pasta e abra http://127.0.0.1:4173. O servidor atende somente arquivos públicos do aplicativo e apenas neste computador.

1. Adicione pelo menos dois filmes. A capa pode ser um link direto de imagem ou um arquivo JPG, PNG ou WebP (até 15 MB). Sem capa, o app cria um pôster com o nome.
2. Clique em **Sortear & começar**. A galera vota em voz alta e uma pessoa registra com os botões **+ / −**.
3. Encerre cada duelo e avance até revelar o campeão. Empates precisam de mais um voto.

As chaves e os votos são salvos neste navegador e dispositivo. Use o mesmo arquivo/endereço para retomar. O navegador pode restringir armazenamento em modo privado ou por `file://`; nesse caso o app avisa. Mantenha a página aberta se aparecer esse aviso. Capas por link e fontes externas precisam de internet; com uploads a aplicação funciona offline usando fontes locais de fallback.

**Ver chaves** mostra o torneio completo. Em quantidades irregulares, alguns filmes avançam automaticamente na primeira rodada. Para nova disputa, os filmes podem ser reaproveitados.

Testes (Node.js): `node --test cine-duelo/tests/*.test.cjs` a partir da pasta superior. Os testes cobrem o motor e o controlador; não substituem inspeção visual no navegador.
