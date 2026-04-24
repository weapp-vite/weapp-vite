export function isPrepareCommand(argv) {
  return Array.isArray(argv) && argv[0] === 'prepare'
}

function getGlobalProcess() {
  return Reflect.get(globalThis, 'process')
}

function isKnownLocalPkgResolveNoise(args) {
  const message = args
    .map((value) => {
      if (value instanceof Error) {
        return `${value.message}\n${value.stack ?? ''}`
      }
      return String(value)
    })
    .join('\n')

  return message.includes('ERR_INVALID_FILE_URL_HOST')
    && (message.includes('local-pkg') || message.includes('mlly'))
}

export function guardKnownLocalPkgResolveNoise() {
  // eslint-disable-next-line no-console -- CLI 启动阶段需要定向过滤已知三方解析噪音
  const originalConsoleError = console.error

  // eslint-disable-next-line no-console -- CLI 启动阶段需要定向过滤已知三方解析噪音
  console.error = (...args) => {
    if (isKnownLocalPkgResolveNoise(args)) {
      return
    }
    originalConsoleError(...args)
  }

  return () => {
    // eslint-disable-next-line no-console -- 恢复原始 console.error
    console.error = originalConsoleError
  }
}

export function formatPrepareSkipMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  return `[prepare] 跳过 .weapp-vite 支持文件预生成：${message}`
}

export function guardPrepareProcessExit(argv) {
  if (!isPrepareCommand(argv)) {
    return () => {}
  }

  const currentProcess = getGlobalProcess()
  const originalExit = currentProcess.exit.bind(currentProcess)
  const originalGlobalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
  const forceSuccessExitCode = () => {
    if (currentProcess.exitCode != null && Number(currentProcess.exitCode) !== 0) {
      currentProcess.exitCode = 0
    }
  }

  const onBeforeExit = () => {
    forceSuccessExitCode()
  }

  currentProcess.exit = () => {
    currentProcess.exitCode = 0
    return undefined
  }
  Object.defineProperty(globalThis, 'process', {
    configurable: true,
    enumerable: originalGlobalProcessDescriptor?.enumerable ?? false,
    get() {
      return new Proxy(currentProcess, {
        get(target, property, receiver) {
          if (property === 'exit') {
            return target.exit
          }
          return Reflect.get(target, property, receiver)
        },
        set(target, property, value, receiver) {
          if (property === 'exitCode') {
            Reflect.set(target, property, value == null || Number(value) === 0 ? 0 : 0, receiver)
            return true
          }
          return Reflect.set(target, property, value, receiver)
        },
      })
    },
    set(value) {
      if (originalGlobalProcessDescriptor?.set) {
        originalGlobalProcessDescriptor.set.call(globalThis, value)
      }
    },
  })
  currentProcess.on('beforeExit', onBeforeExit)

  return () => {
    currentProcess.exit = originalExit
    currentProcess.off('beforeExit', onBeforeExit)
    if (originalGlobalProcessDescriptor) {
      Object.defineProperty(globalThis, 'process', originalGlobalProcessDescriptor)
    }
  }
}

export async function runWeappViteCLI(options = {}) {
  const {
    argv = getGlobalProcess().argv.slice(2),
    importer = () => import('../dist/cli.mjs'),
    write = message => getGlobalProcess().stderr.write(`\n WARN  ${message}\n\n`),
  } = options
  const restorePrepareGuard = guardPrepareProcessExit(argv)
  const restoreKnownNoiseGuard = guardKnownLocalPkgResolveNoise()

  try {
    await importer()
    return true
  }
  catch (error) {
    if (isPrepareCommand(argv)) {
      write(formatPrepareSkipMessage(error))
      return false
    }
    throw error
  }
  finally {
    restoreKnownNoiseGuard()
    if (!isPrepareCommand(argv)) {
      restorePrepareGuard()
    }
  }
}
