import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loggerError = vi.hoisted(() => vi.fn())
const compiler = vi.hoisted(() => ({ loaded: vi.fn(), build: vi.fn(), close: vi.fn() }))
const unexpectedLoad = vi.hoisted(() => vi.fn((name: string): never => {
  throw new Error(`unexpected command dependency: ${name}`)
}))

vi.mock('weapp-ide-cli', () => unexpectedLoad('ide'))
vi.mock('@weapp-core/init', () => unexpectedLoad('init'))
vi.mock('../schematics', () => unexpectedLoad('schematics'))
vi.mock('../createContext', () => unexpectedLoad('compiler context'))
vi.mock('../runtime/compilerSession', () => {
  compiler.loaded()
  return {
    CompilerSession: class {
      context = {
        configService: {
          platform: 'weapp',
          weappViteConfig: {},
          multiPlatform: {},
        },
        buildService: { build: compiler.build },
        watcherService: { closeAll: compiler.close },
      }

      cleanups: Array<() => unknown> = []
      async initialize() { return this.context }
      onClose(cleanup: () => unknown) { this.cleanups.push(cleanup) }
      run<T>(operation: () => Promise<T>) { return operation() }
      async close() {
        for (const cleanup of this.cleanups) {
          await cleanup()
        }
      }
    },
  }
})
vi.mock('../mcp', () => unexpectedLoad('mcp'))
vi.mock('../dashboard', () => unexpectedLoad('dashboard'))
vi.mock('./analyze/dashboard', () => unexpectedLoad('analyze dashboard'))
vi.mock('./upload/builtProject', () => unexpectedLoad('upload'))
vi.mock('./commands/serve/startup', () => unexpectedLoad('dev server'))
vi.mock('../runtime/tsconfigSupport', () => ({ syncManagedTsconfigBootstrapFiles: vi.fn() }))
vi.mock('./logBuildAppFinish', () => ({ logBuildAppFinish: vi.fn() }))
vi.mock('./logBuildPackageSizeReport', () => ({ logBuildPackageSizeReport: vi.fn() }))
vi.mock('../logger', () => ({
  default: { error: loggerError, info: vi.fn(), success: vi.fn(), warn: vi.fn() },
  colors: { green: (value: string) => value, bold: (value: string) => value },
}))

const originalArgv = process.argv
const originalExitCode = process.exitCode

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.exitCode = undefined
  compiler.build.mockResolvedValue({ output: [] })
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('VITEST', 'true')
})

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('CLI command loading', () => {
  it.each([
    ['--help'],
    ['--version'],
    ['build', '--help'],
    ['analyze', '--help'],
    ['mcp', '--help'],
    ['ide', '--help'],
    ['upload', '--help'],
    ['dev', '--help'],
  ])('prints help/version without evaluating command implementations: %j', async (...args) => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    process.argv = ['node', 'weapp-vite', ...args]

    await import('../cli')

    expect(log).toHaveBeenCalled()
    expect(loggerError).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
    expect(unexpectedLoad).not.toHaveBeenCalled()
    expect(compiler.loaded).not.toHaveBeenCalled()
  })

  it('executes an ordinary build without loading IDE, analyze, MCP or upload features', async () => {
    process.argv = ['node', 'weapp-vite', 'build', '--platform', 'weapp']

    await import('../cli')

    expect(loggerError).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
    expect(compiler.loaded).toHaveBeenCalledOnce()
    expect(compiler.build).toHaveBeenCalledOnce()
    expect(compiler.close).toHaveBeenCalledOnce()
    expect(unexpectedLoad).not.toHaveBeenCalled()
  })

  it('rejects unknown build flags before loading the compiler or optional features', async () => {
    process.argv = ['node', 'weapp-vite', 'build', '--unknown-build-option']

    await import('../cli')

    expect(process.exitCode).toBe(1)
    expect(loggerError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Unknown option'),
    }))
    expect(unexpectedLoad).not.toHaveBeenCalled()
    expect(compiler.loaded).not.toHaveBeenCalled()
  })
})
