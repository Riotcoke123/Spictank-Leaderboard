module.exports = {
  apps: [{
    name: "spic",
    script: "./server.js",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      API_BASE_URL: "https://communities.win/api/v2/",
      COMMUNITY: "spictank", 
      DB_PATH: "./leaderboard.db"
    },
    exp_backoff_restart_delay: 100,
    watch: false,
    max_memory_restart: "1G",
    error_file: "/root/.pm2/logs/spic-error.log",
    out_file: "/root/.pm2/logs/spic-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]

}

