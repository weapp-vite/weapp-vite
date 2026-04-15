import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { extendProjectConfig, waitForSocketReady } from './automator.cli-bridge'

function createMockChild(spawnfile = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli') {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const listeners = new Map<string, ((...args: any[]) => void)[]>()

  return {
    child: {
      spawnfile,
      stdout,
      stderr,
      once(event: string, listener: (...args: any[]) => void) {
        const current = listeners.get(event) ?? []
        current.push(listener)
        listeners.set(event, current)
        return this
      },
      emit(event: string, ...args: any[]) {
        for (const listener of listeners.get(event) ?? []) {
          listener(...args)
        }
      },
    },
    stdout,
    stderr,
  }
}

async function reservePort() {
  return await new Promise<{ port: number, close: () => Promise<void> }>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        port,
        close: async () => {
          await new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error)
                return
              }
              resolveClose()
            })
          })
        },
      })
    })
  })
}

describe('waitForSocketReady', () => {
  const closers: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (closers.length > 0) {
      const close = closers.pop()
      await close?.()
    }
  })

  it('fails fast when devtools cli exits before the socket becomes ready', async () => {
    const { child, stderr } = createMockChild()
    const freePort = 6553

    const task = waitForSocketReady({
      child: child as any,
      port: freePort,
      timeoutMs: 5_000,
    })

    stderr.write('TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined\n')
    child.emit('exit', 1, null)

    await expect(task).rejects.toThrow(/WeChat DevTools CLI exited before automator socket was ready[\s\S]*ERR_INVALID_ARG_TYPE/i)
  })

  it('resolves once the automator socket is available', async () => {
    const { child } = createMockChild()
    const reserved = await reservePort()
    closers.push(reserved.close)

    await expect(waitForSocketReady({
      child: child as any,
      port: reserved.port,
      timeoutMs: 2_000,
    })).resolves.toBeUndefined()
  })

  it('does not fail fast on an early successful cli exit without a fatal error signature', async () => {
    const { child, stderr } = createMockChild()

    const task = waitForSocketReady({
      child: child as any,
      port: 6554,
      timeoutMs: 300,
    })

    stderr.write('- initialize\n✔ auto\n')
    child.emit('exit', 0, null)

    await expect(task).rejects.toThrow(/Timed out waiting for automator socket/)
  })

  it('fails fast when spawning the devtools cli itself errors', async () => {
    const { child } = createMockChild()

    const task = waitForSocketReady({
      child: child as any,
      port: 6555,
      timeoutMs: 5_000,
    })

    child.emit('error', new Error('spawn /Applications/wechatwebdevtools.app/Contents/MacOS/cli ENOENT'))

    await expect(task).rejects.toThrow(/Failed to spawn WeChat DevTools CLI/)
  })
})

describe('extendProjectConfig', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  function createProjectConfig(source: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automator-cli-bridge-'))
    tempDirs.push(dir)
    fs.writeFileSync(path.join(dir, 'project.config.json'), source, 'utf8')
    return dir
  }

  it('preserves files without a trailing newline when merged config is unchanged', async () => {
    const projectPath = createProjectConfig('{\n  "appid": "wx123"\n}')

    await extendProjectConfig(projectPath, {
      appid: 'wx123',
    })

    expect(fs.readFileSync(path.join(projectPath, 'project.config.json'), 'utf8')).toBe('{\n  "appid": "wx123"\n}')
  })

  it('preserves files without a trailing newline when writing merged config', async () => {
    const projectPath = createProjectConfig('{\n  "appid": "wx123"\n}')

    await extendProjectConfig(projectPath, {
      setting: {
        es6: true,
      },
    })

    expect(fs.readFileSync(path.join(projectPath, 'project.config.json'), 'utf8')).toBe(
      '{\n  "appid": "wx123",\n  "setting": {\n    "es6": true\n  }\n}',
    )
  })

  it('preserves an existing trailing newline when writing merged config', async () => {
    const projectPath = createProjectConfig('{\n  "appid": "wx123"\n}\n')

    await extendProjectConfig(projectPath, {
      setting: {
        es6: true,
      },
    })

    expect(fs.readFileSync(path.join(projectPath, 'project.config.json'), 'utf8')).toBe(
      '{\n  "appid": "wx123",\n  "setting": {\n    "es6": true\n  }\n}\n',
    )
  })
})
