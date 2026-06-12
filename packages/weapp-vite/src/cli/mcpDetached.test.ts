import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())
const createConnectionMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const fakeProcess = vi.hoisted(() => ({
  argv: ['/node', '/repo/node_modules/weapp-vite/dist/cli.mjs'],
  execPath: '/node',
  env: {},
}))

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}))

vi.mock('node:net', () => ({
  default: {
    createConnection: createConnectionMock,
  },
}))

vi.mock('node:process', () => ({
  default: fakeProcess,
}))

vi.mock('../logger', () => ({
  default: {
    info: loggerInfoMock,
    success: loggerSuccessMock,
    warn: loggerWarnMock,
  },
  colors: {
    cyan: (value: string) => value,
  },
}))

function mockPortClosed() {
  createConnectionMock.mockImplementation(() => {
    const listeners = new Map<string, (...args: any[]) => void>()
    const socket = {
      destroy: vi.fn(),
      once: vi.fn((event: string, listener: (...args: any[]) => void) => {
        listeners.set(event, listener)
        if (event === 'error') {
          queueMicrotask(() => listener(new Error('closed')))
        }
        return socket
      }),
      removeAllListeners: vi.fn(() => socket),
      setTimeout: vi.fn(() => socket),
    }
    return socket
  })
}

function mockPortOpen() {
  createConnectionMock.mockImplementation(() => {
    const socket = {
      destroy: vi.fn(),
      once: vi.fn((event: string, listener: (...args: any[]) => void) => {
        if (event === 'connect') {
          queueMicrotask(listener)
        }
        return socket
      }),
      removeAllListeners: vi.fn(() => socket),
      setTimeout: vi.fn(() => socket),
    }
    return socket
  })
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/')
}

describe('detached mcp auto start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdirMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
    spawnMock.mockReturnValue({
      pid: 12345,
      unref: vi.fn(),
    })
    mockPortClosed()
  })

  it('starts mcp in a detached process and writes runtime manifest', async () => {
    const { maybeStartDetachedMcpServer } = await import('./mcpDetached')

    await maybeStartDetachedMcpServer({
      agentName: 'codex',
      cwd: '/repo/apps/demo',
      isAgent: true,
      mcpConfig: {
        autoStart: true,
        port: 3199,
      },
    })

    expect(spawnMock).toHaveBeenCalledWith('/node', [
      '/repo/node_modules/weapp-vite/dist/cli.mjs',
      'mcp',
      '--transport',
      'streamable-http',
      '--host',
      '127.0.0.1',
      '--port',
      '3199',
      '--endpoint',
      '/mcp',
      '--workspace-root',
      '/repo/apps/demo',
      '--rest-endpoint',
      '/api/weapp/devtools',
    ], {
      cwd: '/repo/apps/demo',
      detached: true,
      stdio: 'ignore',
    })
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    const [runtimeManifestPath, runtimeManifestContent, runtimeManifestEncoding] = writeFileMock.mock.calls[0]
    expect(toPosixPath(String(runtimeManifestPath))).toBe('/repo/apps/demo/.weapp-vite/mcp-runtime.json')
    expect(runtimeManifestContent).toEqual(expect.stringContaining('"pid": 12345'))
    expect(runtimeManifestContent).toEqual(expect.stringContaining('"agentName": "codex"'))
    expect(runtimeManifestEncoding).toBe('utf8')
    expect(loggerSuccessMock).toHaveBeenCalledWith('MCP 服务已在后台自动启动：（AI 终端：codex）')
  })

  it('reuses existing mcp server when the port is already open', async () => {
    const { maybeStartDetachedMcpServer } = await import('./mcpDetached')
    mockPortOpen()

    await maybeStartDetachedMcpServer({
      cwd: '/repo/apps/demo',
      mcpConfig: {
        autoStart: true,
        port: 3199,
      },
    })

    expect(spawnMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining('MCP 服务已存在'))
  })
})
