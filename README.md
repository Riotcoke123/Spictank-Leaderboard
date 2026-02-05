<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

</head>
<body>
    <img src="https://github.com/user-attachments/assets/c520855c-8b1c-4edc-a664-19f7ccfb949a" alt="Spictank Leaderboard">
    <h1>Spictank Leaderboard <span class="badge">v1.0.0</span></h1>
    <p>
        A high-performance Node.js backend and automated fetcher designed to track,
        calculate, and display user rankings for the <strong>Spictank</strong> community on Scored.co.
    </p>
    <div class="feature-list">
        <h2>Core Features</h2>
        <ul>
            <li>
                <strong>Automated Data Fetching:</strong>
                Periodically syncs with the Scored API (v2) using the
                <code>AUTO_UPDATE_INTERVAL</code>.
            </li>
            <li>
                <strong>Weighted Scoring:</strong>
                Every raw post score is multiplied to create a "Calculated Score":
                <p>$$\text{Calculated Score} = \lceil \text{Raw Score} \times 3.14 \rceil$$</p>
            </li>
            <li>
                <strong>Atomic Persistence:</strong>
                Powered by <code>better-sqlite3</code> with WAL mode for reliable data storage.
            </li>
            <li>
                <strong>Persistence:</strong>
                Includes a systemd installation script (<code>install-service.sh</code>)
                for 24/7 uptime on Linux servers.
            </li>
        </ul>
    </div>
    <h2>Scored API Reference</h2>
    <p>
        This project relies on Scored’s official API (v2).
        Full documentation, authentication details, and endpoint references are available here:
    </p>
    <p>
         <a href="https://docs.scored.co/" target="_blank" rel="noopener noreferrer">
            https://docs.scored.co/
        </a>
    </p>
    <h2>Environment Setup</h2>
    <p>
        The application requires a <code>.env</code> file with the following credentials
        to interact with the Scored API:
    </p>
    <pre>
API_BASE_URL=https://api.scored.co/api/v2/post/newv2.json
COMMUNITY=spictank
X_API_KEY=
X_API_PLATFORM=Scored-Desktop
DB_PATH=./leaderboard.db
PORT=3001
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
                <td>GET</td>
                <td>Returns top 100 users by calculated score.</td>
            </tr>
            <tr>
                <td><code>/api/stats</code></td>
                <td>GET</td>
                <td>Aggregates total posts, authors, and the top-ranked user.</td>
            </tr>
            <tr>
                <td><code>/api/authors</code></td>
                <td>GET</td>
                <td>Lists all unique users seen by the crawler.</td>
            </tr>
            <tr>
                <td><code>/api/refresh</code></td>
                <td>POST</td>
                <td>Manually triggers an immediate API sync.</td>
            </tr>
        </tbody>
    </table>
    <h2>Deployment</h2>
    <p>To deploy as a system service, use the provided installation script:</p>
    <pre>
# Make script executable
chmod +x install-service.sh

# Run installer
./install-service.sh
    </pre>
    <p>
        This script automates the creation of the
        <code>leaderboard-updater.service</code>
        and sets up logging at <code>/var/log/leaderboard.log</code>.
    </p>

</body>
</html>
