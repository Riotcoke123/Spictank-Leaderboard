require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const pino = require('pino');
const fs = require('fs');

// =========================
// CONFIG
// =========================
const PORT = process.env.PORT || 3001;
const AUTO_UPDATE_INTERVAL = 90 * 1000;
const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } }
});

// =========================
// DATABASE
// =========================
const dbPath = process.env.DB_PATH || './leaderboard.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

db.exec(`
CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL UNIQUE,
  original_score INTEGER NOT NULL,
  calculated_score INTEGER NOT NULL,
  last_active_ms INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  post_id TEXT UNIQUE,
  title TEXT,
  score INTEGER NOT NULL,
  calculated_score INTEGER NOT NULL,
  created_ms INTEGER,
  url TEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_authors_username ON authors(username);
`);

// =========================
// BACKUP & RESTORE
// =========================
function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `leaderboard-${timestamp}.db`);
    
    // Use SQLite backup API for safe backup
    db.backup(backupPath);
    
    logger.info({ backupPath }, 'Database backup created');
    
    // Keep only last 10 backups
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('leaderboard-') && f.endsWith('.db'))
      .sort()
      .reverse();
    
    if (backups.length > 10) {
      backups.slice(10).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        logger.info({ file: f }, 'Old backup deleted');
      });
    }
    
    return backupPath;
  } catch (err) {
    logger.error({ err }, 'Error creating backup');
    throw err;
  }
}

function exportAuthorsJSON() {
  try {
    const authors = db.prepare(`
      SELECT username, first_seen_at, last_seen_at
      FROM authors
      ORDER BY username
    `).all();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(BACKUP_DIR, `authors-${timestamp}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(authors, null, 2));
    logger.info({ jsonPath, count: authors.length }, 'Authors exported to JSON');
    
    return jsonPath;
  } catch (err) {
    logger.error({ err }, 'Error exporting authors');
    throw err;
  }
}

// =========================
// HELPERS
// =========================
const calculateScore = score => Math.ceil(score * 3.14);

function timeAgoFromMs(epochMs) {
  const nowMs = Date.now();
  const diffSec = Math.floor((nowMs - epochMs) / 1000);
  const units = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  for (const u of units) {
    const value = Math.floor(diffSec / u.seconds);
    if (value >= 1) return `${value} ${u.label}${value > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

// =========================
// FETCH POSTS
// =========================
async function fetchPosts() {
  const apiUrl = `${process.env.API_BASE_URL}?community=${process.env.COMMUNITY}`;
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-api-key': process.env.X_API_KEY,
        'x-api-platform': process.env.X_API_PLATFORM,
        'x-api-secret': process.env.X_API_SECRET,
        'x-xsrf-token': process.env.X_XSRF_TOKEN,
        referer: `https://communities.win/c/${process.env.COMMUNITY}/new`
      },
      timeout: 30000
    });

    return Array.isArray(response.data)
      ? response.data
      : response.data.posts || response.data.data || [];
  } catch (err) {
    logger.error({ err }, 'Error fetching posts');
    return [];
  }
}

// =========================
// UPDATE LEADERBOARD
// =========================
function updateLeaderboard(posts) {
  const upsertPost = db.prepare(`
    INSERT INTO posts (author, post_id, title, score, calculated_score, created_ms, url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_id) DO UPDATE SET
      score = excluded.score,
      calculated_score = excluded.calculated_score
    WHERE posts.score != excluded.score
  `);

  const getExistingScore = db.prepare(`
    SELECT score FROM posts WHERE post_id = ?
  `);

  const upsertAuthor = db.prepare(`
    INSERT INTO authors (username, first_seen_at, last_seen_at)
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      last_seen_at = CURRENT_TIMESTAMP
  `);

  let newPosts = 0;
  let duplicates = 0;
  let updated = 0;

  const rebuildLeaderboard = db.prepare(`
    INSERT OR REPLACE INTO leaderboard (author, original_score, calculated_score, last_active_ms, updated_at)
    SELECT 
      author,
      SUM(score) as original_score,
      SUM(calculated_score) as calculated_score,
      MAX(created_ms) as last_active_ms,
      CURRENT_TIMESTAMP
    FROM posts
    GROUP BY author
  `);

  const tx = db.transaction(posts => {
    let hasChanges = false;

    // Insert new posts
    for (const post of posts) {
      if (!post.author || typeof post.score_up !== 'number' || !post.created) continue;
      const postId = post.id || post.post_id || post.postId;
      if (!postId) continue;

      const calculated = calculateScore(post.score_up);
      const createdMs = post.created;
      const url = post.permalink || post.url || `https://communities.win/c/${process.env.COMMUNITY}/${postId}`;

      try {
        // Save/update author
        upsertAuthor.run(post.author);

        const result = upsertPost.run(
          post.author,
          postId,
          post.title || '',
          post.score_up,
          calculated,
          createdMs,
          url
        );

        if (result.changes > 0) {
          hasChanges = true;
          // Check if this was a new post or an update
          const existing = getExistingScore.get(postId);
          if (!existing) {
            newPosts++;
          } else {
            updated++;
          }
        } else {
          duplicates++;
        }
      } catch (err) {
        logger.error({ err, postId }, 'Error inserting post');
      }
    }

    // Only rebuild leaderboard if there were actual changes
    if (hasChanges) {
      try {
        db.prepare('DELETE FROM leaderboard').run();
        rebuildLeaderboard.run();
      } catch (err) {
        logger.error({ err }, 'Error rebuilding leaderboard');
        throw err;
      }
    }
  });

  tx(posts);
  return { newPosts, duplicates, updated };
}

// =========================
// GET LEADERBOARD & STATS
// =========================
function getLeaderboard(limit = 100) {
  const rows = db.prepare(`
    SELECT author, original_score, calculated_score, last_active_ms,
           (SELECT COUNT(*) FROM posts p WHERE p.author = l.author) AS post_count
    FROM leaderboard l
    ORDER BY calculated_score DESC
    LIMIT ?
  `).all(limit);

  return rows.map(r => ({
    author: r.author,
    original_score: r.original_score,
    calculated_score: r.calculated_score,
    post_count: r.post_count,
    last_active_ago: r.last_active_ms ? timeAgoFromMs(r.last_active_ms) : 'unknown'
  }));
}

function getStats() {
  return {
    totalPosts: db.prepare('SELECT COUNT(*) c FROM posts').get().c,
    totalAuthors: db.prepare('SELECT COUNT(DISTINCT author) c FROM posts').get().c,
    topUser: db.prepare(`
      SELECT author, calculated_score
      FROM leaderboard
      ORDER BY calculated_score DESC
      LIMIT 1
    `).get()
  };
}

// =========================
// AUTO FETCH
// =========================
async function fetchAndUpdateData() {
  try {
    logger.info(`Fetching posts @ ${new Date().toLocaleString()}`);
    const posts = await fetchPosts();

    if (!posts.length) {
      logger.warn('No posts found');
      return;
    }

    const result = updateLeaderboard(posts);
    const stats = getStats();
    logger.info({
      newPosts: result.newPosts,
      updated: result.updated,
      duplicates: result.duplicates,
      totalPosts: stats.totalPosts
    }, 'Leaderboard updated');
  } catch (err) {
    logger.error({ err }, 'Fetch and update error');
  }
}

// =========================
// EXPRESS SERVER
// =========================
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leaderboard', (req, res) => {
  try {
    res.json(getLeaderboard(100));
  } catch (err) {
    logger.error({ err }, 'Error fetching leaderboard');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (err) {
    logger.error({ err }, 'Error fetching stats');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/authors', (req, res) => {
  try {
    const authors = db.prepare(`
      SELECT username, first_seen_at, last_seen_at
      FROM authors
      ORDER BY last_seen_at DESC
    `).all();
    res.json(authors);
  } catch (err) {
    logger.error({ err }, 'Error fetching authors');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/backup', async (req, res) => {
  try {
    const dbBackup = createBackup();
    const jsonBackup = exportAuthorsJSON();
    res.json({ 
      success: true, 
      dbBackup: path.basename(dbBackup),
      jsonBackup: path.basename(jsonBackup)
    });
  } catch (err) {
    logger.error({ err }, 'Error creating backup');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/backup/download/:type', (req, res) => {
  try {
    const { type } = req.params;
    let files;
    
    if (type === 'db') {
      files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('leaderboard-') && f.endsWith('.db'))
        .sort()
        .reverse();
    } else if (type === 'json') {
      files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('authors-') && f.endsWith('.json'))
        .sort()
        .reverse();
    } else {
      return res.status(400).json({ error: 'Invalid backup type' });
    }
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'No backups found' });
    }
    
    const latestBackup = path.join(BACKUP_DIR, files[0]);
    res.download(latestBackup);
  } catch (err) {
    logger.error({ err }, 'Error downloading backup');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    await fetchAndUpdateData();
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Error refreshing data');
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
  
  // Initial backup on startup
  createBackup();
  exportAuthorsJSON();
  
  // Fetch initial data
  fetchAndUpdateData();
  
  // Schedule periodic updates and backups
  setInterval(fetchAndUpdateData, AUTO_UPDATE_INTERVAL);
  setInterval(() => {
    createBackup();
    exportAuthorsJSON();
  }, BACKUP_INTERVAL);
});

// =========================
// GRACEFUL SHUTDOWN
// =========================
const shutdown = () => {
  logger.info('Shutting down...');
  server.close(() => {
    db.close();
    logger.info('Server closed, DB connection closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// =========================
// GLOBAL ERROR HANDLERS
// =========================
process.on('uncaughtException', err => {
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', err => {
  logger.error({ err }, 'Unhandled Rejection');
  process.exit(1);
});