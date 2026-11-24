import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
  createConnection: vi.fn(),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: {
      ...actual,
      readFile: mocks.readFile,
      readdir: mocks.readdir,
      rm: mocks.rm,
    },
  }
})

vi.mock('node:net', () => ({
  default: {
    createConnection: mocks.createConnection,
  },
}))

const projectPath = path.resolve('/workspace/project')

function session(port: number) {
  return {
    installationId: 'stable-cli',
    port,
    projectPath,
    sessionId: 'worker-a',
    updatedAt: '2026-10-08T00:00:00.000Z',
    wsEndpoint: `ws://127.0.0.1:${port}`,
  }
}

describe('automator session persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.readFile.mockReset()
    mocks.readdir.mockReset()
    mocks.rm.mockReset().mockResolvedValue(undefined)
    mocks.createConnection.mockReset().mockImplementation(() => ({
      once: (event: string, callback: () => void) => {
        if (event === 'connect') {
          queueMicrotask(callback)
        }
      },
      destroy: vi.fn(),
    }))
    mocks.readFile.mockRejectedValue(new Error('missing'))
    mocks.readdir.mockResolvedValue([])
  })

  it('resolves a named session when its dynamic port is not supplied', async () => {
    const persisted = session(19_620)
    mocks.readdir.mockResolvedValue(['session.json'])
    mocks.readFile.mockImplementation(async (filePath: string) => filePath.endsWith('session.json')
      ? JSON.stringify(persisted)
      : Promise.reject(new Error('missing')))

    const { readPersistedAutomatorSession } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: 'stable-cli',
      projectPath,
      sessionId: 'worker-a',
    })).resolves.toEqual(persisted)
    expect(mocks.createConnection).toHaveBeenCalledWith({ host: '127.0.0.1', port: persisted.port })
  })

  it('rejects an ambiguous named session with multiple dynamic ports', async () => {
    const first = session(19_620)
    const second = session(19_621)
    mocks.readdir.mockResolvedValue(['first.json', 'second.json'])
    mocks.readFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('first.json')) {
        return JSON.stringify(first)
      }
      if (filePath.endsWith('second.json')) {
        return JSON.stringify(second)
      }
      throw new Error('missing')
    })

    const { readPersistedAutomatorSession } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: 'stable-cli',
      projectPath,
      sessionId: 'worker-a',
    })).resolves.toBeNull()
  })

  it('does not scan other sessions when no named session is requested', async () => {
    const { readPersistedAutomatorSession } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: 'stable-cli',
      projectPath,
    })).resolves.toBeNull()
    expect(mocks.readdir).not.toHaveBeenCalled()
  })

  it('removes a persisted endpoint after its port stops listening', async () => {
    const persisted = session(19_622)
    mocks.readFile.mockImplementation(async (filePath: string) => filePath.endsWith('.json')
      ? JSON.stringify(persisted)
      : Promise.reject(new Error('missing')))
    mocks.createConnection.mockImplementation(() => ({
      once: (event: string, callback: () => void) => {
        if (event === 'error') {
          queueMicrotask(callback)
        }
      },
      destroy: vi.fn(),
    }))

    const { readPersistedAutomatorSession, resolveAutomatorSessionFilePath } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: persisted.installationId,
      projectPath,
      port: persisted.port,
      sessionId: persisted.sessionId,
    })).resolves.toBeNull()
    expect(mocks.rm).toHaveBeenCalledWith(resolveAutomatorSessionFilePath(persisted), { force: true })
  })

  it('keeps a session record replaced while probing its old endpoint', async () => {
    const stale = session(19_626)
    const current = session(19_627)
    mocks.readFile
      .mockResolvedValueOnce(JSON.stringify(stale))
      .mockResolvedValueOnce(JSON.stringify(current))
    mocks.createConnection.mockImplementation(() => ({
      once: (event: string, callback: () => void) => {
        if (event === 'error') {
          queueMicrotask(callback)
        }
      },
      destroy: vi.fn(),
    }))

    const { readPersistedAutomatorSession, resolveAutomatorSessionFilePath } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: stale.installationId,
      projectPath,
      port: stale.port,
      sessionId: stale.sessionId,
    })).resolves.toBeNull()
    expect(mocks.readFile).toHaveBeenNthCalledWith(2, resolveAutomatorSessionFilePath(stale), expect.objectContaining({ encoding: 'utf8' }))
    expect(mocks.rm).not.toHaveBeenCalled()
  })

  it('keeps only a live endpoint when scanning a named session', async () => {
    const stale = session(19_623)
    const live = session(19_624)
    mocks.readdir.mockResolvedValue(['stale.json', 'live.json'])
    mocks.readFile.mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('stale.json')) {
        return JSON.stringify(stale)
      }
      if (filePath.endsWith('live.json')) {
        return JSON.stringify(live)
      }
      throw new Error('missing')
    })
    let connectionCount = 0
    mocks.createConnection.mockImplementation(() => ({
      once: (event: string, callback: () => void) => {
        if ((connectionCount++ === 0 && event === 'error') || (connectionCount > 1 && event === 'connect')) {
          queueMicrotask(callback)
        }
      },
      destroy: vi.fn(),
    }))

    const { readPersistedAutomatorSession } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: live.installationId,
      projectPath,
      sessionId: live.sessionId,
    })).resolves.toEqual(live)
  })

  it('propagates cancellation during a named-session scan', async () => {
    const persisted = session(19_625)
    const controller = new AbortController()
    const reason = new Error('cancelled during endpoint probe')
    mocks.readdir.mockResolvedValue(['session.json'])
    mocks.readFile.mockImplementation(async (filePath: string) => filePath.endsWith('session.json')
      ? JSON.stringify(persisted)
      : Promise.reject(new Error('missing')))
    mocks.createConnection.mockImplementation(() => ({
      once: (event: string) => {
        if (event === 'connect') {
          queueMicrotask(() => controller.abort(reason))
        }
      },
      destroy: vi.fn(),
    }))

    const { readPersistedAutomatorSession } = await import('../src/cli/automator/sessionStore')
    await expect(readPersistedAutomatorSession({
      installationId: persisted.installationId,
      projectPath,
      sessionId: persisted.sessionId,
      signal: controller.signal,
    })).rejects.toBe(reason)
  })
})
