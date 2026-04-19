import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import YTMusic from 'ytmusic-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize YT Music Client
  const ytmusic = new YTMusic();
  await ytmusic.initialize();

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post('/api/match', async (req, res) => {
    const { tracks } = req.body;
    
    if (!Array.isArray(tracks)) {
      return res.status(400).json({ error: 'Invalid tracks data' });
    }

    const results = [];

    // Process tracks sequentially or in small batches to avoid rate limits
    for (const track of tracks) {
      const { isrc, name, artist, durationMs, album } = track;
      let matched = null;
      let tier = 0;
      let reason = 'No match found';

      try {
        // Tier 1: ISRC Search
        if (isrc) {
          const searchResults = await ytmusic.searchSongs(isrc);
          if (searchResults.length > 0) {
            const bestMatch = searchResults[0];
            const durationDiff = Math.abs(bestMatch.duration - (durationMs / 1000));
            
            if (durationDiff <= 2) {
              matched = bestMatch;
              tier = 1;
              reason = 'ISRC match';
            }
          }
        }

        // Tier 2: Fuzzy Match (Artist + Title)
        if (!matched) {
          const query = `${artist} - ${name}`;
          const searchResults = await ytmusic.searchSongs(query);
          
          for (const candidate of searchResults) {
            const durationDiff = Math.abs(candidate.duration - (durationMs / 1000));
            // Check if artist matches loosely (case insensitive contains)
            const artistMatch = candidate.artist.name.toLowerCase().includes(artist.toLowerCase()) || 
                               artist.toLowerCase().includes(candidate.artist.name.toLowerCase());
            
            if (durationDiff <= 2 && artistMatch) {
              matched = candidate;
              tier = 2;
              reason = 'Fuzzy match (Artist + Title + Duration)';
              break;
            }
          }
          
          if (!matched && searchResults.length > 0) {
             reason = 'Potential matches found, but failed duration/artist validation';
          }
        }

        results.push({
          source: track,
          match: matched ? {
            videoId: matched.videoId,
            name: matched.name,
            artist: matched.artist.name,
            duration: matched.duration,
            thumbnails: matched.thumbnails
          } : null,
          tier,
          reason,
          status: matched ? 'success' : 'failed'
        });

      } catch (err) {
        console.error(`Error matching ${name}:`, err);
        results.push({
          source: track,
          match: null,
          tier: 0,
          reason: 'Error during search',
          status: 'error'
        });
      }
    }

    res.json({ results });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
