// PM2 Ecosystem Configuration for MCP Memory Web - PRODUCTION
// Port: 3001 (for production deployment)
// Usage: pm2 start ecosystem.config.cjs
// For staging (port 3002), use: pm2 start ecosystem.staging.config.cjs

module.exports = {
  apps: [{
    name: 'mcp-memory-web',
    script: 'npm',
    args: 'start -- -p 3001',  // Use 'start' for production (built app)
    cwd: './web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
