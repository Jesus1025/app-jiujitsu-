# Mostrar las noticias de la app en la página web

El profesor pidió una sección de "Noticias" al principio de la página (ofertas, competencias,
promociones). Las noticias se publican desde la app y la página las lee sola.

## 1. Configurar la academia

1. En la app: **Más → Ajustes de la academia → Nombre web**, por ejemplo `gracie-santiago`.
2. Al publicar una noticia, activar **"Mostrar también en la página web"**.

## 2. Pegar este bloque en la página

Reemplaza `TU-PROYECTO` y `TU_PUBLISHABLE_KEY` por los datos del proyecto Supabase
(Dashboard → Project Settings → API) y `gracie-santiago` por el nombre web de la academia.
La publishable key es pública: solo permite leer las noticias marcadas para la web.

```html
<section id="noticias"></section>

<script>
  fetch('https://TU-PROYECTO.supabase.co/rest/v1/rpc/public_news', {
    method: 'POST',
    headers: { apikey: 'TU_PUBLISHABLE_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: 'gracie-santiago', p_limit: 5 }),
  })
    .then((response) => response.json())
    .then((items) => {
      const box = document.getElementById('noticias');
      if (!Array.isArray(items) || items.length === 0) {
        box.style.display = 'none';
        return;
      }
      box.innerHTML = '<h2>Noticias</h2>';
      for (const item of items) {
        const article = document.createElement('article');
        const title = document.createElement('h3');
        const date = document.createElement('small');
        const body = document.createElement('p');
        title.textContent = item.title;
        date.textContent = new Date(item.published_at).toLocaleDateString('es-CL');
        body.textContent = item.body;
        article.append(title, date, body);
        box.append(article);
      }
    });
</script>
```

El bloque usa `textContent` (no `innerHTML`) para el contenido de cada noticia, así que un
texto publicado desde la app nunca se ejecuta como código en la página.

## Qué devuelve

Una lista ordenada (las destacadas primero y luego las más recientes) con `title`, `body`,
`kind`, `published_at` y `pinned`. Si el nombre web no existe, devuelve una lista vacía.
