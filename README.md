# TMDB Similar Titles Addon (Movies & Series)

A minimal TMDB addon for Omni Content Hub that shows:
- Trailers, cast, posters, backdrops
- A **separate "Similar Titles"** section on each movie/series page
- Works for **both movies and TV series**

## Deploy on Render
1. Create a new GitHub repo and add these files in the **repo root**:
   - `package.json`
   - `manifest.json`
   - `index.js`
   - `README.md`

2. On Render:
   - **New → Web Service → Connect repo**
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment:
     - `TMDB_API_KEY` = your TMDB key (e.g. `ee5efe712fdab14d1f42783d6f02c324`)

3. After deploy, copy your service URL and append `/manifest.json`, e.g.:
