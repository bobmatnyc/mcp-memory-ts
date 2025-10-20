// PM2 Ecosystem Configuration for MCP Memory Web - STAGING
// Port: 3002 (for development/testing)
// Usage: pm2 start ecosystem.staging.config.cjs

module.exports = {
  apps: [{
    name: 'mcp-memory-web-3002',
    script: 'npm',
    args: 'run dev -- -p 3002',
    cwd: './web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3002
    },
    error_file: './logs/pm2-error-staging.log',
    out_file: './logs/pm2-out-staging.log',
    log_file: './logs/pm2-combined-staging.log',
    time: true
  }]
};
