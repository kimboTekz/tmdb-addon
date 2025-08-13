const express = require("express");
const favicon = require("serve-favicon");
const path = require("path");
const axios = require("axios");
const addon = express();
const analytics = require('./utils/analytics');
const { getCatalog } = require("./lib/getCatalog");
const { getSearch } = require("./lib/getSearch");
const { getManifest, DEFAULT_LANGUAGE } = require("./lib/getManifest");
const { getMeta } = require("./lib/getMeta");
const { getTmdb } = require("./lib/getTmdb");
const { cacheWrapMeta } = require("./lib/getCache");
const { getTrending } = require("./lib/getTrending");
const { parseConfig, getRpdbPoster, checkIfExists } = require("./utils/parseProps");
const { getRequestToken, getSessionId } = require("./lib/getSession");
const { getFavorites, getWatchList } = require("./lib/getPersonalLists");
const { blurImage } = require('./utils/imageProcessor');

addon.use(analytics.middleware);
addon.use(favicon(path.join(__dirname, '../public/favicon.png')));
addon.use(express.static(path.join(__dirname, '../public')));
addon.use(express.static(path.join(__dirname, '../dist')));

const getCacheHeaders = function (opts) {
  opts = opts || {};
  if (!Object.keys(opts).length) return false;

  const headersMap = {
    cacheMaxAge: "max-age",
    staleRevalidate: "stale-while-revalidate",
    staleError: "stale-if-error",
  };

  return Object.entries(headersMap)
    .map(([optKey, header]) => opts[optKey] ? `${header}=${opts[optKey]}` : false)
    .filter(Boolean)
    .join(", ");
};

const respond = function (res, data, opts) {
  const cacheControl = getCacheHeaders(opts);
  if (cacheControl) res.setHeader("Cache-Control", `${cacheControl}, public`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
};

addon.get("/", (_, res) => res.redirect("/configure"));

// ... existing endpoints ...

// =========================================
// NEW: Similar Titles Endpoint for Omni
// =========================================
addon.get("/similar/:type/:tmdbId.json", async (req, res) => {
  const { type, tmdbId } = req.params;
  const config = parseConfig(req.query.catalogChoices || "") || {};
  const language = config.language || DEFAULT_LANGUAGE;
  const apiKey = process.env.TMDB_API_KEY || "ee5efe712fdab14d1f42783d6f02c324";
  
  const tmdbType = (type === "series") ? "tv" : "movie";
  const endpoint = `${process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3"}/${tmdbType}/${tmdbId}/similar`;
  
  try {
    const resp = await axios.get(endpoint, {
      params: { api_key: apiKey, language, page: 1 }
    });

    const results = resp.data.results || [];
    const metas = results.map(item => ({
      id: `tmdb:${tmdbType}:${item.id}`,
      type,
      name: item.title || item.name,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      description: item.overview || "",
      releaseInfo: item.release_date || item.first_air_date || ""
    }));

    respond(res, { metas }, {
      cacheMaxAge: 86400,
      staleRevalidate: 604800,
      staleError: 1209600,
    });

  } catch (err) {
    console.error("Error fetching similar titles:", err.message);
    res.status(500).json({ error: "Unable to fetch similar titles" });
  }
});

// =======================================
// Continue existing handlers below...
// =======================================

addon.get("/:catalogChoices?/manifest.json", async (req, res) => {
  const config = parseConfig(req.params.catalogChoices) || {};
  const manifest = await getManifest(config);
  respond(res, manifest, {
    cacheMaxAge: 12 * 60 * 60,
    staleRevalidate: 14 * 24 * 60 * 60,
    staleError: 30 * 24 * 60 * 60
  });
});

addon.get("/:catalogChoices?/catalog/:type/:id/:extra?.json", async function (req, res) {
  // your existing catalog logic...
});

addon.get("/:catalogChoices?/meta/:type/:id.json", async function (req, res) {
  // your existing meta logic...
});

addon.get("/api/image/blur", async function (req, res) {
  // your existing blur logic...
});

module.exports = addon;
