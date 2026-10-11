import { readFileSync } from 'node:fs'
// eslint-disable-next-line e18e/ban-dependencies -- 启动检查使用与发布 engines 完全相同的 npm semver 语义。
import satisfies from 'semver/functions/satisfies.js'

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

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
    nodeVersion = getGlobalProcess().versions.node,
    importer = () => ['accept', 'mcp'].includes(argv[0])
      ? import('../dist/cli-acceptance.mjs')
      : import('../dist/cli.mjs'),
    write = message => getGlobalProcess().stderr.write(`\n WARN  ${message}\n\n`),
  } = options
  // 在加载 Babel 等依赖前校验同一份发布声明；prepare 的容错不能吞掉不受支持的运行时。
  if (!satisfies(nodeVersion, engines.node)) {
    throw new Error(`weapp-vite requires Node.js ${engines.node}; current version is ${nodeVersion}. Please upgrade Node.js before running this command.`)
  }
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
