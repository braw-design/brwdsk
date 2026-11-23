// brwdsk · sincroniza la colección de Discogs → site/data.json + site/covers/
// Uso: DISCOGS_TOKEN=xxx DISCOGS_USER=brwdsk node scripts/sync.mjs
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const TOKEN = process.env.DISCOGS_TOKEN;
const USER = process.env.DISCOGS_USER || "brwdsk";
if (!TOKEN) { console.error("Falta DISCOGS_TOKEN"); process.exit(1); }

const SITE = path.resolve("site");
const COVERS = path.join(SITE, "covers");
const CACHE_FILE = path.resolve("data/cache.json");
const API = "https://api.discogs.com";
const HEADERS = { "User-Agent": "brwdsk/1.0 +https://github.com/braw-design/brwdsk", Authorization: `Discogs token=${TOKEN}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url.startsWith("http") ? url : API + url, { headers: HEADERS });
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    await sleep(1100); // límite de Discogs: 60 peticiones por minuto
    return r.json();
  }
  throw new Error(`demasiados intentos: ${url}`);
}
const clean = s => String(s || "").replace(/\s*\(\d+\)$/, "").trim(); // "Heist (2)" → "Heist"
const SPECIALS = ["Record Store Day", "Picture Disc", "Zoetrope", "Shape", "Numbered", "Limited Edition", "Club Edition", "Deluxe Edition", "Anniversary Edition"];

async function main() {
  await fs.mkdir(COVERS, { recursive: true });
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(CACHE_FILE, "utf8")); } catch {}

  // Campos personalizados (Dueño, Sesiones, Notes…)
  const { fields } = await get(`/users/${USER}/collection/fields`);
  const fieldName = Object.fromEntries(fields.map(f => [f.id, f.name.toLowerCase()]));

  // Colección completa
  let items = [], page = 1, pages = 1;
  do {
    const d = await get(`/users/${USER}/collection/folders/0/releases?per_page=100&page=${page}&sort=added&sort_order=desc`);
    items.push(...d.releases); pages = d.pagination.pages; page++;
  } while (page <= pages);
  console.log(`Colección: ${items.length} discos`);

  const records = [];
  for (const it of items) {
    const id = it.id;
    // Detalle del lanzamiento (se guarda en caché para no repetir peticiones)
    if (!cache[id]) {
      console.log("  nuevo →", it.basic_information.title);
      const rel = await get(`/releases/${id}`);
      let year = rel.year || it.basic_information.year || 0;
      if (rel.master_id) { try { const m = await get(`/masters/${rel.master_id}`); if (m.year) year = m.year; } catch {} }
      cache[id] = { rel: {
        title: rel.title, artists: rel.artists?.map(a => clean(a.name)), year, released: rel.year,
        genres: rel.genres, styles: rel.styles, labels: rel.labels?.map(l => clean(l.name)), formats: rel.formats,
        series: rel.series?.map(s => s.name), uri: rel.uri,
        tracklist: (rel.tracklist || []).filter(t => t.type_ === "track").map(t => ({ p: t.position, t: t.title })),
        image: (rel.images || []).find(i => i.type === "primary")?.uri || rel.images?.[0]?.uri || it.basic_information.cover_image,
        have: rel.community?.have, want: rel.community?.want,
      } };
    }
    const c = cache[id].rel;

    // Portada normalizada a 600×600
    const coverFile = path.join(COVERS, `${id}.jpg`);
    let cover = null;
    try { await fs.access(coverFile); cover = `covers/${id}.jpg`; } catch {
      if (c.image) {
        try {
          const r = await fetch(c.image, { headers: HEADERS }); await sleep(600);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            await sharp(buf).resize(600, 600, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toFile(coverFile);
            cover = `covers/${id}.jpg`;
          }
        } catch (e) { console.warn("  sin portada:", c.title, e.message); }
      }
    }

    // Campos personalizados de este disco
    const notes = {};
    for (const n of it.notes || []) notes[fieldName[n.field_id]] = n.value;
    const sessions = String(notes["sesiones"] || "").split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

    // Formato
    const fmt = (c.formats || []).find(f => f.name === "Vinyl") || (c.formats || [])[0] || {};
    const desc = fmt.descriptions || [];
    const size = desc.find(d => /^\d+"$/.test(d)) || (desc.includes("LP") ? '12"' : null);
    const rpm = (desc.find(d => /RPM/.test(d)) || "").replace(/\s*RPM/, "").replace("33 ⅓", "33") || null;
    const text = [fmt.text, ...(c.formats || []).map(f => f.text)].filter(Boolean)[0] || "";
    const series = (c.series || []).find(s => /vinyl me, please/i.test(s));
    const special = series ? "Vinyl Me, Please" : (SPECIALS.find(s => desc.includes(s) || new RegExp(s, "i").test(text)) || null);

    records.push({
      id, url: c.uri,
      t: c.title, a: (c.artists || []).join(" & "), y: c.year,
      g: (c.genres || [])[0] || "", st: (c.styles || [])[0] || null,
      lbl: (c.labels || [])[0] || "", ed: [c.released, text].filter(Boolean).join(" · "),
      size, rpm, col: text && !/^(black|180|gatefold)/i.test(text) ? text : null, sp: special,
      tr: c.tracklist.map(t => t.t), pos: c.tracklist.map(t => t.p),
      s: sessions, note: notes["notes"] || null,
      cover, add: it.date_added,
      rare: c.have ? Math.round((c.want || 0) / c.have * 100) / 100 : null,
      // El dueño (Dueño) NO se publica: el catálogo es para invitados.
    });
  }

  await fs.writeFile(CACHE_FILE, JSON.stringify(cache));
  await fs.writeFile(path.join(SITE, "data.json"), JSON.stringify({ updated: new Date().toISOString(), records }, null, 1));
  console.log(`Listo: ${records.length} discos en site/data.json`);
}
main().catch(e => { console.error(e); process.exit(1); });
