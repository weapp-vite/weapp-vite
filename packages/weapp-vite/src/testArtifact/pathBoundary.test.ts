import path from 'node:path'
import posixPath from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface WatchRegistration {
  paths: string[]
  options: { ignored: (file: string) => boolean }
}

const state = vi.hoisted(() => ({
  dependencies: [] as string[],
  registrations: [] as WatchRegistration[],
}))

vi.mock('node:path', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:path')>()
  return { ...original, default: original.win32 }
})

vi.mock('./inputs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./inputs')>()
  return { ...original, fingerprintPaths: vi.fn(async () => 'unchanged-input-and-output') }
})

vi.mock('../runtime/compilerSession', () => ({
  CompilerSession: class {
    async initialize(options: { cwd: string, outputRoot: string }) {
      return {
        buildService: { build: async () => undefined },
        configService: {
          // 隔离监听器对合法绝对路径的边界契约，用 join 保留 UNC 前缀。
          absoluteSrcRoot: posixPath.join(options.cwd, 'src'),
          configFileDependencies: [...state.dependencies],
          outDir: posixPath.normalize(options.outputRoot),
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
    watch(paths: string[], options: WatchRegistration['options']) {
      state.registrations.push({ paths: [...paths], options })
      return {
        add() {},
        async unwatch() {},
        async close() {},
        once(event: string, callback: () => void) {
          if (event === 'ready') {
            callback()
          }
          return this
        },
        on() {
          return this
        },
      }
    },
  },
}))

const watchers: Array<{ close: () => Promise<void> }> = []
const fixtureRoots = ['C:/artifact-fixture', '//server/share/artifact-fixture']

beforeEach(() => {
  state.dependencies = []
  state.registrations.length = 0
})

afterEach(async () => {
  await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
})

function devicePath(file: string) {
  const native = path.normalize(file)
  return native.startsWith('\\\\') ? `\\\\?\\UNC\\${native.slice(2)}` : `\\\\?\\${native}`
}

async function openWatcher(root: string) {
  const { watchTestArtifact } = await import('../testArtifact')
  const sourceRoot = posixPath.join(root, 'src')
  const sourceChildren = [
    posixPath.join(sourceRoot, 'pages/index.ts'),
    path.join(sourceRoot, 'components/card.ts'),
    posixPath.join(sourceRoot, '..cache/index.ts'),
    devicePath(posixPath.join(sourceRoot, 'device/index.ts')),
  ]
  // 输出使用普通目录名，避免保留目录正则提前掩盖输出归属判断。
  const outputRoot = posixPath.join(root, 'generated')
  const outputChildren = [
    path.join(outputRoot, 'nested/app.js'),
    posixPath.join(outputRoot, '..cache/app.js'),
    devicePath(posixPath.join(outputRoot, 'device/app.js')),
  ]
  const siblings = [posixPath.join(root, 'src-extra/config.ts'), path.join(root, 'generated-extra/config.ts')]
  state.dependencies = [...sourceChildren, path.normalize(sourceRoot), outputRoot, ...outputChildren, ...siblings]
  const watcher = await watchTestArtifact({ cwd: path.normalize(root), outDir: path.normalize(outputRoot) })
  watchers.push(watcher)
  expect(state.registrations).toHaveLength(1)
  return { ...state.registrations[0]!, root, sourceRoot, sourceChildren, outputRoot, outputChildren, siblings }
}

function spellings(file: string) {
  // Windows namespaced 路径保留合法的反斜杠形式，其普通路径别名由其他条目覆盖。
  if (file.startsWith('\\\\?\\')) {
    return [file]
  }
  return [posixPath.normalize(file), path.normalize(file)]
}

describe('test artifact Windows watch path boundaries', () => {
  it.each(fixtureRoots)('watches the source directory once without explicitly registering either spelling of its children: %s', async (root) => {
    const registration = await openWatcher(root)
    const watched = registration.paths.map(file => path.normalize(file))

    expect(watched.filter(file => file === path.normalize(registration.sourceRoot))).toHaveLength(1)
    for (const child of registration.sourceChildren) {
      expect(watched).not.toContain(path.normalize(child))
    }
  })

  it.each(fixtureRoots)('allows both spellings of explicit input ancestors through otherwise ignored directories: %s', async (root) => {
    const registration = await openWatcher(posixPath.join(root, 'node_modules/fixture'))
    for (const ancestor of [registration.root, registration.sourceRoot]) {
      for (const file of spellings(ancestor)) {
        expect(registration.options.ignored(file), `Explicit input ancestor: ${file}`).toBe(false)
      }
    }
  })

  it.each(fixtureRoots)('excludes both spellings of the output root and its descendants from watch ownership: %s', async (root) => {
    const registration = await openWatcher(root)
    const watched = registration.paths.map(file => path.normalize(file))
    for (const output of [registration.outputRoot, ...registration.outputChildren]) {
      expect(watched).not.toContain(path.normalize(output))
      for (const file of spellings(output)) {
        expect(registration.options.ignored(file), `Generated output: ${file}`).toBe(true)
      }
    }
  })

  it.each(fixtureRoots)('preserves explicit dependencies in sibling directories sharing source or output prefixes: %s', async (root) => {
    const registration = await openWatcher(root)
    const watched = registration.paths.map(file => path.normalize(file))
    for (const sibling of registration.siblings) {
      expect(watched).toContain(path.normalize(sibling))
      for (const file of spellings(sibling)) {
        expect(registration.options.ignored(file), `Independent dependency: ${file}`).toBe(false)
      }
    }
  })
})
