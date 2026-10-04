import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snapshotDist, waitForInitialDistSnapshot, waitForStableDistSnapshot } from './output'

const fsHooks = vi.hoisted(() => ({
  beforeRead: undefined as ((filename: string) => Promise<void>) | undefined,
  beforeStat: undefined as ((filename: string) => Promise<void>) | undefined,
  beforeReaddir: undefined as ((filename: string) => Promise<void>) | undefined,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    async readFile(...args: Parameters<typeof original.readFile>) {
      await fsHooks.beforeRead?.(String(args[0]))
      return original.readFile(...args)
    },
    async stat(...args: Parameters<typeof original.stat>) {
      await fsHooks.beforeStat?.(String(args[0]))
      return original.stat(...args)
    },
    async readdir(...args: Parameters<typeof original.readdir>) {
      await fsHooks.beforeReaddir?.(String(args[0]))
      return original.readdir(...args)
    },
  }
})

const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  fsHooks.beforeRead = undefined
  fsHooks.beforeStat = undefined
  fsHooks.beforeReaddir = undefined
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function createOutput() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-output-'))
  roots.push(root)
  await writeFile(path.join(root, 'app.json'), '{"pages":[]}')
  return root
}

function createPublication() {
  const published = Promise.withResolvers<string>()
  return {
    published,
    dev: {
      waitForInitialBuild: vi.fn((_timeoutMs?: number) => published.promise),
      waitFor: <T>(task: Promise<T>) => task,
    },
  }
}

describe('workspace HMR initial output publication', () => {
  it('does not accept an early app.json and quiet partial tree before the build has published', async () => {
    const root = await createOutput()
    const { published, dev } = createPublication()
    let observed = false
    const waiting = waitForInitialDistSnapshot(dev, root, 20, 2_000).then((snapshot) => {
      observed = true
      return snapshot
    })
    try {
      // 首次写出可能先暴露 app.json，随后才清理 npm 并发布其余产物。
      await sleep(100)
      expect(observed).toBe(false)
      const npmRoot = path.join(root, 'miniprogram_npm', 'dependency')
      await mkdir(npmRoot, { recursive: true })
      await writeFile(path.join(npmRoot, 'LICENSE'), 'intermediate')
      await rm(npmRoot, { recursive: true })
      await mkdir(npmRoot, { recursive: true })
      await writeFile(path.join(npmRoot, 'index.js'), 'published')
      published.resolve('小程序初次构建完成')
      const snapshot = await waiting
      expect([...snapshot.keys()]).toEqual(['app.json', 'miniprogram_npm/dependency/index.js'])
      expect(snapshot.get('miniprogram_npm/dependency/index.js')).toEqual({
        hash: createHash('sha256').update('published').digest('hex'),
        size: 9,
      })
      expect(dev.waitForInitialBuild).toHaveBeenCalledWith(2_000)
    }
    finally {
      published.resolve('cleanup')
      await waiting
    }
  })

  it('preserves the build failure even when app.json is already visible', async () => {
    const root = await createOutput()
    const { published, dev } = createPublication()
    const failure = new Error('initial npm publication failed')
    const rejected = expect(waitForInitialDistSnapshot(dev, root, 20, 2_000)).rejects.toBe(failure)
    published.reject(failure)
    await rejected
  })

  it('uses a completion already received before the initial snapshot wait begins', async () => {
    const root = await createOutput()
    const { published, dev } = createPublication()
    published.resolve('小程序初次构建完成')
    const snapshot = await waitForInitialDistSnapshot(dev, root, 20, 2_000)
    expect(dev.waitForInitialBuild).toHaveBeenCalledOnce()
    expect([...snapshot.keys()]).toEqual(['app.json'])
  })

  it('rejects a completed build whose required app.json was removed', async () => {
    const root = await createOutput()
    const { published, dev } = createPublication()
    await rm(path.join(root, 'app.json'))
    published.resolve('小程序初次构建完成')
    await expect(waitForInitialDistSnapshot(dev, root, 20, 2_000)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('shares the startup budget with publication and rejects a snapshot finishing after its deadline', async () => {
    const root = await createOutput()
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const dev = {
      waitForInitialBuild: async () => {
        now = 80
        return '小程序初次构建完成'
      },
      waitFor: <T>(task: Promise<T>) => task,
    }
    fsHooks.beforeRead = async () => {
      now += 15
    }
    await expect(waitForInitialDistSnapshot(dev, root, 5, 100)).rejects.toThrow('Timed out')
    expect(now).toBe(110)
  })

  it('stops observing output when the dev process exits during a pending scan', async () => {
    const root = await createOutput()
    const reading = Promise.withResolvers<void>()
    const releaseRead = Promise.withResolvers<void>()
    const exited = Promise.withResolvers<never>()
    let directoryReads = 0
    fsHooks.beforeReaddir = async () => {
      directoryReads += 1
    }
    fsHooks.beforeRead = async () => {
      reading.resolve()
      await releaseRead.promise
    }
    const dev = {
      waitForInitialBuild: async () => '小程序初次构建完成',
      waitFor: <T>(task: Promise<T>) => Promise.race([task, exited.promise]),
    }
    const failure = new Error('dev process exited during observation')
    const rejected = expect(waitForInitialDistSnapshot(dev, root, 20, 2_000)).rejects.toBe(failure)
    try {
      await reading.promise
      exited.reject(failure)
      await rejected
    }
    finally {
      releaseRead.resolve()
    }
    await sleep(60)
    expect(directoryReads).toBe(1)
  })
})

describe('workspace HMR output snapshot races', () => {
  it.each([
    { change: 'removed', operation: 'stat', injectedCode: undefined },
    { change: 'removed', operation: 'readFile', injectedCode: undefined },
    { change: 'directory-replaced', operation: 'stat', injectedCode: undefined },
    { change: 'directory-replaced', operation: 'readFile', injectedCode: undefined },
    { change: 'injected ENOENT', operation: 'stat', injectedCode: 'ENOENT' },
    { change: 'injected ENOENT', operation: 'readFile', injectedCode: 'ENOENT' },
    { change: 'injected ENOTDIR', operation: 'stat', injectedCode: 'ENOTDIR' },
    { change: 'injected ENOTDIR', operation: 'readFile', injectedCode: 'ENOTDIR' },
  ] as const)('discards the entire $change snapshot from $operation and restarts its stability window', async ({ change, operation, injectedCode }) => {
    const original = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const root = await createOutput()
    const temporaryRoot = path.join(root, 'temporary')
    const transientFile = path.join(temporaryRoot, 'LICENSE')
    const appFile = path.join(root, 'app.json')
    const fourthRead = Promise.withResolvers<void>()
    const releaseRead = Promise.withResolvers<void>()
    let directoryReads = 0
    let appReads = 0
    let raced = false
    let observedCode: unknown

    fsHooks.beforeReaddir = async (filename) => {
      if (filename === root && ++directoryReads === 2) {
        await mkdir(temporaryRoot)
        await writeFile(transientFile, 'transient')
      }
    }
    const invalidateListedFile = async (filename: string) => {
      if (filename !== transientFile || raced) {
        return
      }
      raced = true
      await rm(temporaryRoot, { recursive: true })
      if (change === 'directory-replaced') {
        await writeFile(temporaryRoot, 'directory replaced by a file')
      }
      try {
        // 受控错误单独锁定两个分支；真实场景保留宿主文件系统返回的错误。
        if (injectedCode) {
          throw Object.assign(new Error(`snapshot ${operation} failed: ${injectedCode}`), { code: injectedCode })
        }
        await original[operation](transientFile)
      }
      catch (error) {
        observedCode = (error as NodeJS.ErrnoException).code
        throw error
      }
      finally {
        await rm(temporaryRoot, { force: true })
      }
    }
    fsHooks.beforeStat = operation === 'stat' ? invalidateListedFile : undefined
    fsHooks.beforeRead = async (filename) => {
      if (operation === 'readFile') {
        await invalidateListedFile(filename)
      }
      if (filename === appFile && ++appReads === 4) {
        fourthRead.resolve()
        await releaseRead.promise
      }
    }

    const waiting = waitForStableDistSnapshot(root, 20, 2_000)
    const settled = waiting.then(
      snapshot => ({ kind: 'returned' as const, snapshot }),
      error => ({ kind: 'failed' as const, error }),
    )
    try {
      // 逐文件吞错会在第二轮提前返回；未重置稳定计时会在第三轮提前返回。
      expect(await Promise.race([
        fourthRead.promise.then(() => ({ kind: 'fourth-read' as const })),
        settled,
      ])).toEqual({ kind: 'fourth-read' })
      // Windows libuv 将 ERROR_DIRECTORY 映射为 ENOENT，POSIX 通常返回 ENOTDIR。
      const expectedCodes = injectedCode ? [injectedCode] : change === 'removed' ? ['ENOENT'] : ['ENOENT', 'ENOTDIR']
      expect(expectedCodes).toContain(observedCode)
      const published = '{"pages":["pages/final/index"]}'
      await writeFile(appFile, published)
      releaseRead.resolve()
      const snapshot = await waiting
      expect([...snapshot.keys()]).toEqual(['app.json'])
      expect(snapshot.get('app.json')).toEqual({
        hash: createHash('sha256').update(published).digest('hex'),
        size: Buffer.byteLength(published),
      })
      expect(appReads).toBeGreaterThanOrEqual(5)
    }
    finally {
      releaseRead.resolve()
      await settled
    }
  })

  it('keeps a direct measurement strict when a listed file disappears', async () => {
    const root = await createOutput()
    const appFile = path.join(root, 'app.json')
    fsHooks.beforeStat = async (filename) => {
      if (filename === appFile) {
        await rm(appFile)
      }
    }
    await expect(snapshotDist(root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['EACCES', 'EPERM', 'EIO'])('preserves %s instead of retrying it as a changing directory', async (code) => {
    const root = await createOutput()
    const failure = Object.assign(new Error(`snapshot read failed: ${code}`), { code })
    let reads = 0
    fsHooks.beforeRead = async () => {
      reads += 1
      throw failure
    }
    await expect(waitForStableDistSnapshot(root, 20, 2_000)).rejects.toBe(failure)
    expect(reads).toBe(1)
  })
})
