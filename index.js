const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Put your TMDB key here
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ee5efe712fdab14d1f42783d6f02c324';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

app.use(cors());

// Basic home route
app.get('/', (req, res) => {
    res.json({
        name: 'TMDB Similar Titles Addon',
        description: 'Fetch similar movies or TV shows like Netflix recommendations',
        endpoints: {
            similar_movies: '/similar/movie/:id',
            similar_tv: '/similar/tv/:id'
        }
    });
});

// Fetch similar movies
app.get('/similar/movie/:id', async (req, res) => {
    try {
        const response = await fetch(`${TMDB_BASE_URL}/movie/${req.params.id}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch similar movies' });
    }
});

// Fetch similar TV shows
app.get('/similar/tv/:id', async (req, res) => {
    try {
        const response = await fetch(`${TMDB_BASE_URL}/tv/${req.params.id}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch similar TV shows' });
    }
});

app.listen(PORT, () => {
    console.log(`TMDB Similar Addon running on port ${PORT}`);
});
