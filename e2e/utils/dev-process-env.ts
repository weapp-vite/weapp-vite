import process from 'node:process'

interface DevProcessEnvOptions {
  disableSidecarWatch?: boolean
}

export function createDevProcessEnv(options: DevProcessEnvOptions = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    CHOKIDAR_USEPOLLING: '1',
    CHOKIDAR_INTERVAL: '120',
  }
  if (options.disableSidecarWatch) {
    env.WEAPP_VITE_DISABLE_SIDECAR_WATCH = '1'
  }
  delete env.CI
  delete env.VITEST
  delete env.VITEST_MODE
  delete env.VITEST_POOL_ID
  delete env.VITEST_WORKER_ID
  delete env.NODE_OPTIONS
  return env
}
