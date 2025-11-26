import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as npmModule from '@/npm'

const getMock = vi.hoisted(() => vi.fn())

class FakeResponse extends EventEmitter {
  statusCode?: number
  setEncoding = vi.fn()
  resume = vi.fn()
}

vi.mock('node:https', () => {
  const mock = getMock
  return {
    default: {
      get: mock,
    },
    get: mock,
  }
})

describe('npm', () => {
  afterEach(() => {
    getMock.mockReset()
    vi.restoreAllMocks()
  })

  it('fetches latest version from npm registry', async () => {
    getMock.mockImplementation((_, handler) => {
      const res = new FakeResponse()
      res.statusCode = 200
      handler(res as any)
      queueMicrotask(() => {
        res.emit('data', '{"version":"1.2.3"}')
        res.emit('end')
      })
      return { on: vi.fn().mockReturnThis() }
    })

    await expect(npmModule.getLatestVersionFromNpm('demo')).resolves.toBe('1.2.3')
    expect(getMock).toHaveBeenCalledWith('https://registry.npmjs.org/demo/latest', expect.any(Function))
  })

  it('rejects when response is an error', async () => {
    getMock.mockImplementation((_, handler) => {
      const res = new FakeResponse()
      res.statusCode = 500
      handler(res as any)
      return { on: vi.fn().mockReturnThis() }
    })

    await expect(npmModule.getLatestVersionFromNpm('bad')).rejects.toThrow(/failed with status 500/)
  })

  it('rejects when response object is missing', async () => {
    getMock.mockImplementation((_, handler) => {
      handler(undefined as any)
      return { on: vi.fn().mockReturnThis() }
    })

    await expect(npmModule.getLatestVersionFromNpm('bad')).rejects.toThrow(/unknown/)
  })

  it('rejects when response is missing a version', async () => {
    getMock.mockImplementation((_, handler) => {
      const res = new FakeResponse()
      res.statusCode = 200
      handler(res as any)
      queueMicrotask(() => {
        res.emit('data', '{}')
        res.emit('end')
      })
      return { on: vi.fn().mockReturnThis() }
    })

    await expect(npmModule.getLatestVersionFromNpm('demo')).rejects.toThrow(/missing version/)
  })

  it('rejects when registry returns invalid json', async () => {
    getMock.mockImplementation((_, handler) => {
      const res = new FakeResponse()
      res.statusCode = 200
      handler(res as any)
      queueMicrotask(() => {
        res.emit('data', '{ invalid')
        res.emit('end')
      })
      return { on: vi.fn().mockReturnThis() }
    })

    await expect(npmModule.getLatestVersionFromNpm('demo')).rejects.toBeInstanceOf(Error)
  })

  it('latestVersion prefixes resolved versions and swallows failures', async () => {
    getMock.mockImplementationOnce((_, handler) => {
      const res = new FakeResponse()
      res.statusCode = 200
      handler(res as any)
      queueMicrotask(() => {
        res.emit('data', '{"version":"3.2.1"}')
        res.emit('end')
      })
      return { on: vi.fn().mockReturnThis() }
    })
    await expect(npmModule.latestVersion('demo')).resolves.toBe('^3.2.1')

    getMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await expect(npmModule.latestVersion('demo')).resolves.toBeNull()
  })

  it('latestVersion returns null for empty resolved value', async () => {
    await expect(npmModule.latestVersion('demo', '^', async () => '')).resolves.toBeNull()
  })
})
