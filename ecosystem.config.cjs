module.exports = {
  apps: [{
    name: 'mcp-memory-web',
    script: 'node_modules/.bin/next',
    args: 'dev -p 3001',
    cwd: './web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    }
  }]
};
