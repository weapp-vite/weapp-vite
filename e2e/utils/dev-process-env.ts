import process from 'node:process'

const E2E_MACHINE_LEASE_ENV = 'WEAPP_VITE_E2E_MACHINE_LEASE'

interface DevProcessEnvOptions {
  disableSidecarWatch?: boolean
  keepE2EEnv?: boolean
  stripE2EEnv?: boolean
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
  delete env.TEST
  delete env.VITEST
  delete env.VITEST_MODE
  delete env.VITEST_POOL_ID
  delete env.VITEST_WORKER_ID
  if (options.keepE2EEnv !== true && options.stripE2EEnv !== false) {
    const machineLease = env[E2E_MACHINE_LEASE_ENV]
    for (const key of Object.keys(env)) {
      if (key.startsWith('WEAPP_VITE_E2E_')) {
        delete env[key]
      }
    }
    if (machineLease !== undefined) {
      env[E2E_MACHINE_LEASE_ENV] = machineLease
    }
  }
  if (options.nodeOptions) {
    env.NODE_OPTIONS = options.nodeOptions
  }
  else {
    delete env.NODE_OPTIONS
  }
  return env
}
