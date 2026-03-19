import process from 'node:process'

export function isPrepareCommand(argv) {
  return Array.isArray(argv) && argv[0] === 'prepare'
}

export function formatPrepareSkipMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  return `[prepare] 跳过 .weapp-vite 支持文件预生成：${message}`
}

export function guardPrepareProcessExit(argv) {
  if (!isPrepareCommand(argv)) {
    return () => {}
  }

  const originalExit = process.exit.bind(process)
  const forceSuccessExitCode = () => {
    if (process.exitCode != null && Number(process.exitCode) !== 0) {
      process.exitCode = 0
    }
  }

  const onBeforeExit = () => {
    forceSuccessExitCode()
  }

  process.exit = (code) => {
    process.exitCode = code == null || Number(code) === 0 ? 0 : 0
    return undefined
  }
  process.on('beforeExit', onBeforeExit)

  return () => {
    process.exit = originalExit
    process.off('beforeExit', onBeforeExit)
  }
}

export async function runWeappViteCLI(options = {}) {
  const {
    argv = process.argv.slice(2),
    importer = () => import('../dist/cli.mjs'),
    write = message => process.stderr.write(`\n WARN  ${message}\n\n`),
  } = options
  const restorePrepareGuard = guardPrepareProcessExit(argv)

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
    if (!isPrepareCommand(argv)) {
      restorePrepareGuard()
    }
  }
}
