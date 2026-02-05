module.exports = {
  apps: [{
    name: "spic",
    script: "./server.js",
    // Set the port to 3001 as requested
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      // Include your .env variables here if they are not being loaded automatically
      API_BASE_URL: "https://communities.win/api/v2/",
      COMMUNITY: "your_community_name", 
      DB_PATH: "./leaderboard.db"
    },
    // Restart policy
    exp_backoff_restart_delay: 100,
    watch: false,
    max_memory_restart: "1G",
    // Logging
    error_file: "/root/.pm2/logs/spic-error.log",
    out_file: "/root/.pm2/logs/spic-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
}