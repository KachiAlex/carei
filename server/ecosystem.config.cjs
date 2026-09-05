module.exports = {
  apps: [{
    name: 'carei-api',
    script: 'server.js',
    cwd: '/var/www/carei/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: '/var/log/carei/error.log',
    out_file: '/var/log/carei/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
}
