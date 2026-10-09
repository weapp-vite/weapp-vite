import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    default: {
      ...actual,
      readFile: mocks.readFile,
      readdir: mocks.readdir,
    },
  }
})

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
})
