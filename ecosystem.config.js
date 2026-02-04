/**
 * PM2 Ecosystem Configuration for LumentuiAPI
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js --env production
 *   pm2 stop ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 *
 * Documentation: https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'lumentui-api',

      // Script to execute
      script: './dist/main.js',

      // Working directory (relative to current directory)
      cwd: process.cwd(),

      // Node.js interpreter
      interpreter: 'node',
      interpreter_args: '',

      // ==========================================
      // Instance Configuration
      // ==========================================
      instances: 1, // Number of instances (1 = single instance)
      exec_mode: 'fork', // Execution mode: 'fork' or 'cluster'

      // ==========================================
      // Environment Variables
      // ==========================================
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      env_file: '.env.production', // Load environment from file

      // ==========================================
      // Logging Configuration
      // ==========================================
      error_file: './data/logs/pm2-error.log',
      out_file: './data/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true, // Merge logs from all instances
      log_type: 'json', // Log type: 'json' or raw

      // ==========================================
      // Restart Strategy
      // ==========================================
      autorestart: true, // Auto-restart on crash
      max_restarts: 10, // Max restarts within min_uptime before stopping
      min_uptime: '10s', // Minimum uptime before considered stable
      restart_delay: 5000, // Delay between restarts (milliseconds)
      exp_backoff_restart_delay: 100, // Exponential backoff restart delay

      // ==========================================
      // Resource Limits
      // ==========================================
      max_memory_restart: '300M', // Auto-restart if memory exceeds limit

      // ==========================================
      // Graceful Shutdown
      // ==========================================
      kill_timeout: 5000, // Time to wait before force kill (milliseconds)
      wait_ready: true, // Wait for app to emit 'ready' event
      listen_timeout: 10000, // Time to wait for app to listen (milliseconds)
      shutdown_with_message: false, // Shutdown on 'shutdown' message

      // ==========================================
      // Watch & Reload
      // ==========================================
      watch: false, // Watch for file changes (disabled in production)
      watch_delay: 1000, // Delay before restart on file change
      ignore_watch: [
        // Paths to ignore when watching
        'node_modules',
        'data',
        'logs',
        '.git',
        'coverage',
        'dist',
        '*.log',
        '*.db',
        '*.db-wal',
        '*.db-shm',
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },

      // ==========================================
      // Advanced Options
      // ==========================================
      source_map_support: true, // Enable source map support
      instance_var: 'INSTANCE_ID', // Environment variable for instance ID

      // Cron restart (optional)
      // cron_restart: '0 3 * * *',  // Restart daily at 3 AM

      // Post-deploy hooks (optional)
      // post_update: ['npm install', 'npm run build'],

      // ==========================================
      // Monitoring & Metrics
      // ==========================================
      // Uncomment to enable PM2+ monitoring
      // pmx: true,
      // automation: true,
    },
  ],

  // ==========================================
  // Deployment Configuration (Optional)
  // ==========================================
  deploy: {
    production: {
      user: process.env.USER || 'deploy',
      host: 'your-host',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/lumentui.git',
      path: process.env.HOME + '/production/lumentui-prod',
      'post-deploy':
        'npm ci --production && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};
