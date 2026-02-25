import process from 'node:process'

export function createDevProcessEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    WEAPP_VITE_DISABLE_SIDECAR_WATCH: '1',
    CHOKIDAR_USEPOLLING: '1',
    CHOKIDAR_INTERVAL: '120',
  }
  delete env.VITEST
  delete env.VITEST_MODE
  delete env.VITEST_POOL_ID
  delete env.VITEST_WORKER_ID
  delete env.NODE_OPTIONS
  return env
}
