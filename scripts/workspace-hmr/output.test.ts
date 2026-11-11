import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listFiles, snapshotDist, waitForInitialDistSnapshot, waitForStableDistSnapshot } from './output'

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

async function replaceExistingFile(source: string, destination: string) {
  try {
    await rename(source, destination)
    return
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) {
      throw error
    }
  }

  // Windows 不允许 rename 覆盖现有文件；先移走旧目标再完成同目录发布，保持夹具的最终目录变化。
  const displaced = `${destination}.displaced`
  await rename(destination, displaced)
  try {
    await rename(source, destination)
  }
  finally {
    await rm(displaced, { force: true })
  }
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
  it.each(['miniprogram_npm', 'node_modules'])('does not accept an early app.json before the complete %s build has published', async (directory) => {
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
      const npmRoot = path.join(root, directory, 'dependency')
      await mkdir(npmRoot, { recursive: true })
      await writeFile(path.join(npmRoot, 'LICENSE'), 'intermediate')
      await rm(npmRoot, { recursive: true })
      await mkdir(npmRoot, { recursive: true })
      await writeFile(path.join(npmRoot, 'index.js'), 'published')
      published.resolve('小程序初次构建完成')
      const snapshot = await waiting
      expect([...snapshot.keys()]).toEqual(['app.json', `${directory}/dependency/index.js`])
      expect(snapshot.get(`${directory}/dependency/index.js`)).toEqual({
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
  it('keeps source exclusions separate from the entire physical publication inventory', async () => {
    const root = await createOutput()
    const files = [
      'node_modules/@scope/library/dist/index.js',
      'sub/node_modules/library/index.js',
      'miniprogram_npm/library/node_modules/nested/index.js',
      'dist/nested.js',
      '.weapp-vite/retained.js',
    ]
    for (const file of files) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), file)
    }
    expect((await listFiles(root)).map(file => path.relative(root, file).replaceAll('\\', '/'))).toEqual(['app.json'])
    const snapshot = await snapshotDist(root)
    expect([...snapshot.keys()].sort()).toEqual(['app.json', ...files].sort())
    for (const file of files) {
      expect(snapshot.get(file)).toEqual({ hash: createHash('sha256').update(file).digest('hex'), size: Buffer.byteLength(file) })
    }
  })

  it.each(['node_modules/library/index.js', 'miniprogram_npm/library/index.js'])('rejects a listed npm file disappearing during the complete snapshot: %s', async (file) => {
    const root = await createOutput()
    const filename = path.join(root, file)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, 'module.exports = {};')
    fsHooks.beforeStat = async (candidate) => {
      if (candidate === filename) {
        await rm(filename)
      }
    }
    await expect(snapshotDist(root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['stat', 'readFile'] as const)('preserves the exact %s failure after a listed staged stylesheet is atomically published', async (operation) => {
    const original = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const root = await createOutput()
    const staged = path.join(root, 'style.next')
    const output = path.join(root, 'index.wxss')
    await writeFile(staged, 'view { color: red; }')
    let failure: unknown
    const publish = async (filename: string) => {
      if (filename !== staged) {
        return
      }
      await rename(staged, output)
      try {
        await original[operation](staged)
      }
      catch (error) {
        failure = error
        throw error
      }
    }
    fsHooks.beforeStat = operation === 'stat' ? publish : undefined
    fsHooks.beforeRead = operation === 'readFile' ? publish : undefined
    const result = await snapshotDist(root).then(() => undefined, error => error as unknown)
    expect(failure).toMatchObject({ code: 'ENOENT' })
    expect(result).toBe(failure)
    expect(await original.readFile(output, 'utf8')).toBe('view { color: red; }')
  })

  it('restarts the whole stability window after a staged stylesheet disappears through same-directory rename', async () => {
    const root = await createOutput()
    const staged = path.join(root, 'style.next')
    const output = path.join(root, 'index.wxss')
    const published = 'view { color: red; }'
    await writeFile(output, published)
    let scans = 0
    let now = 0
    let renamed = false
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    fsHooks.beforeReaddir = async (filename) => {
      if (filename === root) {
        now = scans++ * 20
        if (scans === 2) {
          // 相同字节发布也必须舍弃竞争轮次，不能拼出看似稳定的部分集合。
          await writeFile(staged, published)
        }
      }
    }
    fsHooks.beforeStat = async (filename) => {
      if (filename === staged && !renamed) {
        renamed = true
        await replaceExistingFile(staged, output)
      }
    }
    const snapshot = await waitForStableDistSnapshot(root, 20, 2_000)
    expect(renamed).toBe(true)
    expect(scans).toBe(4)
    expect([...snapshot.keys()]).toEqual(['app.json', 'index.wxss'])
    expect(snapshot.get('index.wxss')).toEqual({ hash: createHash('sha256').update(published).digest('hex'), size: Buffer.byteLength(published) })
  })

  it('bounds simultaneous reads and preserves sorted inventory when files finish out of order', async () => {
    const root = await createOutput()
    const names = Array.from({ length: 35 }, (_, index) => `asset-${String(index).padStart(2, '0')}.txt`)
    await Promise.all(names.map(name => writeFile(path.join(root, name), name)))
    const saturated = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const othersStarted = Promise.withResolvers<void>()
    const releaseApp = Promise.withResolvers<void>()
    let active = 0
    let peak = 0
    let started = 0
    fsHooks.beforeRead = async (filename) => {
      peak = Math.max(peak, ++active)
      if (active === 16) {
        saturated.resolve()
      }
      if (++started === names.length + 1) {
        othersStarted.resolve()
      }
      try {
        await release.promise
        if (filename === path.join(root, 'app.json')) {
          await releaseApp.promise
        }
      }
      finally {
        active -= 1
      }
    }
    const waiting = snapshotDist(root)
    try {
      await saturated.promise
      expect(peak).toBe(16)
      expect(started).toBe(16)
      release.resolve()
      await othersStarted.promise
      releaseApp.resolve()
      const snapshot = await waiting
      expect(peak).toBe(16)
      expect([...snapshot.keys()]).toEqual(['app.json', ...names])
      expect(snapshot.size).toBe(36)
    }
    finally {
      release.resolve()
      releaseApp.resolve()
      await waiting
    }
  })

  it('waits for in-flight reads to settle after a failure and never starts the queued remainder', async () => {
    const root = await createOutput()
    await Promise.all(Array.from({ length: 30 }, (_, index) => writeFile(path.join(root, `asset-${index}.txt`), 'asset')))
    const saturated = Promise.withResolvers<void>()
    const failed = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const failure = new Error('strict output read failed')
    let started = 0
    let finished = 0
    let settled = false
    fsHooks.beforeRead = async (filename) => {
      if (++started === 16) {
        saturated.resolve()
      }
      if (filename === path.join(root, 'app.json')) {
        await saturated.promise
        failed.resolve()
        throw failure
      }
      await release.promise
      finished += 1
    }
    const waiting = snapshotDist(root)
    void waiting.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    const rejected = expect(waiting).rejects.toBe(failure)
    try {
      await failed.promise
      // 让读取错误传递到 worker，随后才释放仍在执行的其他读取。
      await Promise.resolve()
      await Promise.resolve()
      expect(settled).toBe(false)
      expect(started).toBe(16)
      expect(finished).toBe(0)
    }
    finally {
      release.resolve()
      await rejected
    }
    expect(settled).toBe(true)
    expect(started).toBe(16)
    expect(finished).toBe(15)
  })

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
    const temporaryRoot = path.join(root, 'node_modules')
    const transientFile = path.join(temporaryRoot, 'LICENSE')
    const appFile = path.join(root, 'app.json')
    const fourthRead = Promise.withResolvers<void>()
    const releaseRead = Promise.withResolvers<void>()
    let directoryReads = 0
    let appReads = 0
    let raced = false
    let observedCode: unknown
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    fsHooks.beforeReaddir = async (filename) => {
      if (filename !== root) {
        return
      }
      // 仅在整轮扫描开始时推进逻辑时间，真实文件系统和 sleep 耗时不消耗测试预算。
      now = directoryReads++ * 20
      if (directoryReads === 2) {
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
      expect(directoryReads).toBe(4)
      expect(appReads).toBe(4)
      expect(now).toBe(60)
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
