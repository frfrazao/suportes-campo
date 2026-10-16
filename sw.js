// Service worker do "Suportes em Campo": guarda o app no aparelho pra'
// abrir sem internet (em campo o sinal só existe em alguns lugares).
// Desenhos e marcações NÃO passam por aqui -- ficam no IndexedDB/localStorage
// da própria página. Troque VERSAO a cada publicação pra' forçar atualização.
const VERSAO = 'suportes-campo-v5';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Android: "Compartilhar" um .campo.zip do WhatsApp com o app (share_target
  // do manifest). Guarda o(s) arquivo(s) numa fila e abre a página, que
  // importa e limpa a fila (ver iniciar() no index.html).
  if (req.method === 'POST' && url.pathname.endsWith('/compartilhar')) {
    e.respondWith((async () => {
      try {
        const dados = await req.formData();
        const fila = await caches.open('compartilhados');
        let i = 0;
        for (const f of dados.getAll('arquivos')) {
          if (!(f instanceof File)) continue;
          await fila.put(new Request(`./_compartilhado/${Date.now()}-${i++}`),
            new Response(f, { headers: { 'x-nome': encodeURIComponent(f.name || 'pacote.zip') } }));
        }
      } catch (err) { /* abre o app mesmo assim */ }
      return Response.redirect(new URL('./?compartilhado=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // página: tenta a rede (pega versão nova), sem rede usa a guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }

  // arquivos do app e fontes do Google: cache primeiro, rede como reserva
  const fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === self.location.origin || fonte) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
