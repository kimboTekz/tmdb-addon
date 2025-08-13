const express = require('express');
const needle = require('needle');
const cors = require('cors');

const app = express();
app.use(cors());

// ⚙️ TMDB key via env var (Render → Environment → TMDB_API_KEY)
const TMDB_API_KEY = process.env.TMDB_API_KEY; // set to: ee5efe712fdab14d1f42783d6f02c324
if (!TMDB_API_KEY) {
  console.warn('[WARN] TMDB_API_KEY is not set. Set it on Render for the addon to work.');
}
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = (path, size = 'w500') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

// Serve manifest directly from file
app.get('/manifest.json', (req, res) => {
  res.sendFile(__dirname + '/manifest.json');
});

// Simple health check
app.get('/', (_req, res) => res.send('TMDB Similar Addon is running.'));

// Catalog: TMDB Discover for movies/series
app.get('/catalog/:type/:id.json', async (req, res) => {
  const { type } = req.params;
  const tmdbType = type === 'movie' ? 'movie' : 'tv';

  const url = `${TMDB_BASE}/discover/${tmdbType}?api_key=${TMDB_API_KEY}&include_adult=false&sort_by=popularity.desc`;

  try {
    const { body } = await needle('get', url, { json: true });
    const results = Array.isArray(body?.results) ? body.results : [];

    const metas = results.map(item => ({
      id: `tmdb:${tmdbType}:${item.id}`,     // stable id format
      type,
      name: item.title || item.name,
      poster: IMG(item.poster_path, 'w500'),
      background: IMG(item.backdrop_path, 'original'),
      releaseInfo: (item.release_date || item.first_air_date || '').slice(0, 4),
      description: item.overview || ''
    }));

    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ metas, cacheMaxAge: 3600 });
  } catch (err) {
    console.error('[catalog] error:', err?.message || err);
    return res.status(500).json({ metas: [], cacheMaxAge: 600 });
  }
});

// Meta: details + trailers/cast + Similar Titles section
app.get('/meta/:type/:rawId.json', async (req, res) => {
  const { type, rawId } = req.params;        // type is 'movie' or 'series'
  const preferred = type === 'series' ? 'tv' : 'movie';

  // Accept ids like: tmdb:movie:123, tmdb:tv:456, or tt1234567 (IMDb)
  function parseId(s) {
    if (!s) return null;
    if (/^tmdb:(movie|tv):\d+$/.test(s)) {
      const [, k, id] = s.split(':');
      return { scheme: 'tmdb', kind: k, id };
    }
    if (/^tt\d{7,}$/.test(s)) return { scheme: 'imdb', id: s };
    return null;
  }

  async function tmdbFindByImdb(imdbId, preferKind) {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const { body } = await needle('get', url, { json: true });
    if (preferKind === 'movie' && body?.movie_results?.length) return { kind: 'movie', id: body.movie_results[0].id };
    if (preferKind === 'tv' && body?.tv_results?.length) return { kind: 'tv', id: body.tv_results[0].id };
    if (body?.movie_results?.length) return { kind: 'movie', id: body.movie_results[0].id };
    if (body?.tv_results?.length) return { kind: 'tv', id: body.tv_results[0].id };
    return null;
  }

  try {
    const parsed = parseId(rawId);
    let tmdbId = null;
    let kind = preferred;

    if (parsed?.scheme === 'tmdb') {
      tmdbId = parsed.id;
      kind = parsed.kind || preferred;
    } else if (parsed?.scheme === 'imdb') {
      const mapped = await tmdbFindByImdb(parsed.id, preferred);
      if (mapped) { tmdbId = mapped.id; kind = mapped.kind; }
    } else {
      return res.json({ meta: null });
    }

    if (!tmdbId) return res.json({ meta: null });

    // details + videos + credits
    const detailsUrl = `${TMDB_BASE}/${kind}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits,external_ids`;
    const similarUrl = `${TMDB_BASE}/${kind}/${tmdbId}/similar?api_key=${TMDB_API_KEY}&page=1`;

    const [{ body: det }, { body: sim }] = await Promise.all([
      needle('get', detailsUrl, { json: true }),
      needle('get', similarUrl, { json: true })
    ]);

    // build meta
    const name = kind === 'tv' ? (det?.name || det?.original_name) : (det?.title || det?.original_title);
    const year = (kind === 'tv' ? det?.first_air_date : det?.release_date) || '';

    let trailer = null;
    const vids = det?.videos?.results || [];
    const yt = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer');
    if (yt) trailer = `https://www.youtube.com/watch?v=${yt.key}`;

    const cast = (det?.credits?.cast || []).slice(0, 12).map(c => c.name);

    const meta = {
      id: rawId.startsWith('tmdb:') ? rawId : `tmdb:${kind}:${tmdbId}`,
      type, // 'movie' or 'series'
      name,
      description: det?.overview || '',
      poster: IMG(det?.poster_path, 'w500'),
      background: IMG(det?.backdrop_path, 'original'),
      releaseInfo: year.slice(0, 4),
      cast,
      trailer,
      // 👇 Separate “Similar Titles” section rendered as an extra catalog
      extras: [
        {
          name: "Similar Titles",
          type: "catalog",
          id: `similar-${kind}-${tmdbId}`,
          metas: (sim?.results || []).map(s => ({
            id: `tmdb:${kind}:${s.id}`,
            type,
            name: s.title || s.name,
            poster: IMG(s.poster_path, 'w500'),
            background: IMG(s.backdrop_path, 'original'),
            description: s.overview || '',
            releaseInfo: (s.release_date || s.first_air_date || '').slice(0, 4)
          }))
        }
      ]
    };

    res.set('Cache-Control', 'public, max-age=86400');
    return res.json({ meta });
  } catch (err) {
    console.error('[meta] error:', err?.message || err);
    return res.json({ meta: null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TMDB Similar Addon running on port ${PORT}`));
