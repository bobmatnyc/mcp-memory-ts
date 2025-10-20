/**
 * PM2 Ecosystem Configuration for Remote MCP Server
 *
 * This configuration deploys the remote MCP server on port 3003
 * as a production service with auto-restart and monitoring.
 *
 * Usage:
 *   pm2 start ecosystem.remote-mcp.config.cjs
 *   pm2 logs mcp-memory-remote
 *   pm2 stop mcp-memory-remote
 *   pm2 restart mcp-memory-remote
 */

module.exports = {
  apps: [
    {
      name: 'mcp-memory-remote',
      script: 'npm',
      args: 'run mcp-server-remote',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        REMOTE_MCP_PORT: '3003',
        REMOTE_MCP_HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
        MCP_DEBUG: '0',
      },
      error_file: './logs/remote-mcp-error.log',
      out_file: './logs/remote-mcp-out.log',
      log_file: './logs/remote-mcp-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
