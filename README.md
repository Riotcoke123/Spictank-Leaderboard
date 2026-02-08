<!DOCTYPE html>
<html lang="en">
<head>

</head>
<body>
    <img src="https://github.com/user-attachments/assets/c520855c-8b1c-4edc-a664-19f7ccfb949a" alt="Spictank Leaderboard" class="hero-img">
    <h1>Spictank Leaderboard <span class="badge">v1.0.1</span></h1>
    <p>
        A high-performance Node.js backend and automated crawler designed to track, 
        calculate, and display user rankings for the <strong>Spictank</strong> community on Scored.co. 
        It provides a real-time API for community engagement metrics.
    </p>
    <div class="feature-list">
        <h2>🚀 Core Features</h2>
        <ul>
            <li><strong>Automated Data Sync:</strong> Periodically fetches from Scored API (v2) every 90 seconds.</li>
            <li><strong>Weighted Scoring:</strong> Implements a custom multiplier for community-specific metrics.</li>
            <li><strong>Robust Persistence:</strong> <code>better-sqlite3</code> with Write-Ahead Logging (WAL) for concurrent read/write performance.</li>
            <li><strong>Automated Backups:</strong> Dual-layer backup system (SQLite binary + Author JSON exports) every 6 hours.</li>
            <li><strong>Production Ready:</strong> Includes systemd service scripts and <code>pino-pretty</code> logging.</li>
        </ul>
    </div>
    <h2>📊 Scoring Logic</h2>
    <p>Every post's raw score is processed through a deterministic multiplier to generate the leaderboard rank:</p>
    <p>$$\text{Calculated Score} = \lceil \text{Raw Score} \times 3.14 \rceil$$</p>
    <h2>⚙️ Environment Setup</h2>
    <p>Create a <code>.env</code> file in the root directory:</p>
    <pre>
PORT=3001
DB_PATH=./leaderboard.db
BACKUP_DIR=./backups
COMMUNITY=spictank
API_BASE_URL=https://api.scored.co/api/v2/post/newv2.json
X_API_KEY=your_key_here
X_API_PLATFORM=Scored-Desktop
X_API_SECRET=your_secret_here
X_XSRF_TOKEN=your_token_here
    </pre>
    <h2>📡 API Endpoints</h2>
    <table>
        <thead>
            <tr>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>/api/leaderboard</code></td>
                <td><span class="badge" style="background:#0366d6">GET</span></td>
                <td>Returns top 100 users ranked by calculated score.</td>
            </tr>
            <tr>
                <td><code>/api/stats</code></td>
                <td><span class="badge" style="background:#0366d6">GET</span></td>
                <td>Aggregated totals (Posts, Authors, Top User).</td>
            </tr>
            <tr>
                <td><code>/api/authors</code></td>
                <td><span class="badge" style="background:#0366d6">GET</span></td>
                <td>Full list of unique community members tracked.</td>
            </tr>
            <tr>
                <td><code>/api/refresh</code></td>
                <td><span class="badge" style="background:#6f42c1">POST</span></td>
                <td>Triggers an immediate manual sync with Scored.</td>
            </tr>
            <tr>
                <td><code>/api/backup</code></td>
                <td><span class="badge" style="background:#6f42c1">POST</span></td>
                <td>Forces a database and JSON export backup.</td>
            </tr>
        </tbody>
    </table>
    <h2>📦 Deployment (Linux/Systemd)</h2>
    <p>To ensure 24/7 uptime, use the included installer:</p>
    <pre><code>chmod +x install-service.sh
sudo ./install-service.sh</code></pre>
    <p>Logs are streamed to <code>/var/log/leaderboard.log</code> via the <code>pino</code> logger.</p>
    <hr>
    <p style="font-size: 0.8rem; color: #6a737d;">
        Official Scored API Documentation: <a href="https://docs.scored.co/" target="_blank">https://docs.scored.co/</a>
    </p>
</body>
</html>
