import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface PublicationGate {
  atBuild: number
  consumed: boolean
  entered: ReturnType<typeof Promise.withResolvers<void>>
  released: ReturnType<typeof Promise.withResolvers<void>>
}

const state = vi.hoisted(() => ({
  builds: 0,
  buildInputs: [] as string[],
  gate: undefined as PublicationGate | undefined,
  handlers: new Map<string, () => void>(),
  outputRoots: new Set<string>(),
}))

vi.mock('./inputs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./inputs')>()
  return {
    ...original,
    async fingerprintPaths(input: Iterable<string>, excluded: string[] = []) {
      const paths = [...input]
      const gate = state.gate
      // 只暂停包含输出的发布摘要，输入校验继续读取真实文件内容。
      if (gate && !gate.consumed && state.builds === gate.atBuild && excluded.length === 0
        && paths.some(file => state.outputRoots.has(path.resolve(file)))) {
        gate.consumed = true
        gate.entered.resolve()
        await gate.released.promise
      }
      return original.fingerprintPaths(paths, excluded)
    },
  }
})

vi.mock('../runtime/compilerSession', () => ({
  CompilerSession: class {
    async initialize(options: { cwd: string, outputRoot: string }) {
      state.outputRoots.add(path.resolve(options.outputRoot))
      return {
        configService: {
          absoluteSrcRoot: path.join(options.cwd, 'src'),
          outDir: options.outputRoot,
        },
        buildService: {
          async build() {
            state.builds++
            const source = await fs.readFile(path.join(options.cwd, 'src/marker.txt'), 'utf8')
            state.buildInputs.push(source)
            await fs.mkdir(options.outputRoot, { recursive: true })
            await fs.writeFile(path.join(options.outputRoot, 'marker.txt'), source)
          },
        },
      }
    }

    run<T>(task: () => Promise<T>) {
      return task()
    }

    async close() {}
  },
}))

vi.mock('chokidar', () => ({
  default: {
    watch: () => ({
      add() {},
      async close() {},
      async unwatch() {},
      once(event: string, callback: () => void) {
        if (event === 'ready') {
          callback()
        }
        return this
      },
      on(event: string, callback: () => void) {
        state.handlers.set(event, callback)
        return this
      },
    }),
  },
}))

const projects: string[] = []
const watchers: Array<{ close: () => Promise<void> }> = []

beforeEach(() => {
  state.builds = 0
  state.buildInputs.length = 0
  state.gate = undefined
  state.handlers.clear()
  state.outputRoots.clear()
})

afterEach(async () => {
  state.gate?.released.resolve()
  await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
  await Promise.all(projects.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  vi.useRealTimers()
})

async function createProject() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-publication-'))
  projects.push(cwd)
  const source = path.join(cwd, 'src/marker.txt')
  const outDir = path.join(cwd, '.weapp-vite/artifact')
  await fs.mkdir(path.dirname(source), { recursive: true })
  await fs.writeFile(source, 'initial')
  return { cwd, outDir, source, output: path.join(outDir, 'marker.txt') }
}

function pausePublication(atBuild: number) {
  const gate: PublicationGate = {
    atBuild,
    consumed: false,
    entered: Promise.withResolvers<void>(),
    released: Promise.withResolvers<void>(),
  }
  state.gate = gate
  return gate
}

describe('test artifact fingerprint publication', () => {
  it('does not certify old output when source changes while its publication fingerprint is captured', async () => {
    const { buildTestArtifact, isTestArtifactCurrent } = await import('../testArtifact')
    const project = await createProject()
    const gate = pausePublication(1)
    const building = buildTestArtifact({ cwd: project.cwd, outDir: project.outDir })
    try {
      await gate.entered.promise
      expect(await fs.readFile(project.output, 'utf8')).toBe('initial')
      await fs.writeFile(project.source, 'changed-during-publication')
      gate.released.resolve()
      const artifact = await building

      expect(await fs.readFile(project.source, 'utf8')).toBe('changed-during-publication')
      expect(await fs.readFile(project.output, 'utf8')).toBe('initial')
      expect(await isTestArtifactCurrent(artifact)).toBe(false)
    }
    finally {
      gate.released.resolve()
      await building.catch(() => undefined)
    }
  })

  it('continues a dirty rebuild when another edit arrives during fingerprint publication', async () => {
    vi.useFakeTimers()
    const { isTestArtifactCurrent, watchTestArtifact } = await import('../testArtifact')
    const project = await createProject()
    const onRebuilt = vi.fn()
    const watcher = await watchTestArtifact({ cwd: project.cwd, outDir: project.outDir, onRebuilt })
    watchers.push(watcher)
    const gate = pausePublication(2)

    await fs.writeFile(project.source, 'first-edit')
    state.handlers.get('change')!()
    await vi.advanceTimersByTimeAsync(20)
    await gate.entered.promise
    expect(await fs.readFile(project.output, 'utf8')).toBe('first-edit')

    await fs.writeFile(project.source, 'second-edit')
    state.handlers.get('change')!()
    // 发布仍被 barrier 阻塞时运行第二次防抖，确保 dirty 已在活动构建中登记。
    await vi.advanceTimersByTimeAsync(20)
    gate.released.resolve()

    await vi.waitFor(() => {
      expect(onRebuilt).toHaveBeenCalledTimes(2)
      expect(state.buildInputs).toEqual(['initial', 'first-edit', 'second-edit'])
    }, { timeout: 1000, interval: 10 })
    expect(await fs.readFile(project.output, 'utf8')).toBe('second-edit')
    expect(await isTestArtifactCurrent(watcher.artifact)).toBe(true)
  })
})
