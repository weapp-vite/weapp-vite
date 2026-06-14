import process from 'node:process'

interface DevProcessEnvOptions {
  disableSidecarWatch?: boolean
  nodeOptions?: string
  usePolling?: boolean
}

export function createDevProcessEnv(options: DevProcessEnvOptions = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
  }
  if (options.usePolling !== false) {
    env.CHOKIDAR_USEPOLLING = '1'
    env.CHOKIDAR_INTERVAL = '120'
  }
  else {
    delete env.CHOKIDAR_USEPOLLING
    delete env.CHOKIDAR_INTERVAL
  }
  if (options.disableSidecarWatch) {
    env.WEAPP_VITE_DISABLE_SIDECAR_WATCH = '1'
  }
  delete env.CI
  delete env.VITEST
  delete env.VITEST_MODE
  delete env.VITEST_POOL_ID
  delete env.VITEST_WORKER_ID
  if (options.nodeOptions) {
    env.NODE_OPTIONS = options.nodeOptions
  }
  else {
    delete env.NODE_OPTIONS
  }
  return env
}
