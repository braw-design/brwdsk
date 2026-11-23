# brwdsk

Catálogo de vinilos de la casa, sincronizado con Discogs.

- **Dar de alta un disco:** agrégalo a la colección de Discogs (usuario `brwdsk`). Opcional: campos *Dueño*, *Sesiones* (separadas por coma) y *Notes* (aparece como "Nota de la casa").
- **Actualizar el sitio:** pestaña **Actions** → *Sincronizar con Discogs* → **Run workflow**. En 2–3 minutos el sitio se actualiza.
- La llave de Discogs vive como secreto del repositorio (`DISCOGS_TOKEN`), nunca en el código.
