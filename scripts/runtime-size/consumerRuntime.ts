import type { createTestProject } from '../../mpcore/packages/test/src/project'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

interface ConsumerTestRuntime {
  createTestProject: typeof createTestProject
}

export interface ConsumerRuntimePackage {
  name: '@mpcore/test'
  version: string
  entry: string
  entrySha256: string
}

export interface LoadedConsumerRuntime {
  createTestProject: typeof createTestProject
  package: ConsumerRuntimePackage
}

export interface ConsumerRuntimeObservation {
  scenario: 'minimal' | 'typical'
  provider: 'headless'
  route: string
  initial: { text: string, count?: number, computed?: number }
  afterTap?: { text: string, count: number, computed: number }
  diagnosticCounts: Record<string, number>
  closed: true
}

function assertInstalledPath(root: string, filename: string) {
  const relative = path.relative(path.join(root, 'node_modules'), filename)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Consumer test runtime escapes its installed node_modules tree.')
  }
}

/** 由消费者目录内的 ESM 模块解析包入口，禁止回退到工作区运行时。 */
export async function loadConsumerRuntime(root: string): Promise<LoadedConsumerRuntime> {
  const directory = await mkdtemp(path.join(root, 'runtime-attribution-loader-'))
  try {
    const resolver = path.join(directory, 'resolve.mjs')
    await writeFile(resolver, 'export const entry = import.meta.resolve("@mpcore/test")\n')
    const resolved = await import(pathToFileURL(resolver).href) as { entry?: unknown }
    assert.equal(typeof resolved.entry, 'string', 'Consumer @mpcore/test ESM entry was not resolved.')
    const entry = await realpath(fileURLToPath(resolved.entry as string))
    assertInstalledPath(root, entry)
    const manifestFile = await realpath(path.join(root, 'node_modules/@mpcore/test/package.json'))
    assertInstalledPath(root, manifestFile)
    const packageRelativeEntry = path.relative(path.dirname(manifestFile), entry)
    if (packageRelativeEntry === '..' || packageRelativeEntry.startsWith(`..${path.sep}`) || path.isAbsolute(packageRelativeEntry)) {
      throw new Error('Consumer @mpcore/test entry is outside its installed package.')
    }
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { name?: unknown, version?: unknown }
    assert.equal(manifest.name, '@mpcore/test')
    assert.equal(typeof manifest.version, 'string')
    const runtime = await import(pathToFileURL(entry).href) as Partial<ConsumerTestRuntime>
    assert.equal(typeof runtime.createTestProject, 'function', 'Installed @mpcore/test must export createTestProject.')
    return {
      createTestProject: runtime.createTestProject!,
      package: {
        name: '@mpcore/test',
        version: manifest.version as string,
        entry: path.relative(root, entry).replaceAll('\\', '/'),
        entrySha256: createHash('sha256').update(await readFile(entry)).digest('hex'),
      },
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function readCounter(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(normalized)
  assert.ok(match, `Unexpected published-consumer counter text: ${normalized}`)
  return { text: normalized, count: Number(match[1]), computed: Number(match[2]) }
}

/** 每个场景读取当前消费者的真实构建产物，关闭会话后才返回通过证据。 */
export async function verifyConsumerRuntime(
  root: string,
  scenario: 'minimal' | 'typical',
  runtime: LoadedConsumerRuntime,
): Promise<ConsumerRuntimeObservation> {
  const project = runtime.createTestProject({
    artifact: {
      projectPath: root,
      miniprogramRootPath: path.join(root, 'dist'),
      appConfigPath: path.join(root, 'dist/app.json'),
    },
    failOnConsoleError: true,
  })
  const route = '/pages/index/index'
  let observation: Omit<ConsumerRuntimeObservation, 'closed'>
  try {
    const result = await project.renderPage(route)
    let initial: ConsumerRuntimeObservation['initial']
    let afterTap: ConsumerRuntimeObservation['afterTap']
    if (scenario === 'minimal') {
      const node = await result.screen.findByText('minimal published consumer')
      initial = { text: node.textContent.trim() }
      assert.equal(initial.text, 'minimal published consumer')
    }
    else {
      const button = await result.screen.findByRole('button', { name: /^1\s*\/\s*2$/ })
      initial = readCounter(button.textContent)
      assert.deepEqual(initial, { text: '1 / 2', count: 1, computed: 2 })
      await result.user.tap(button)
      afterTap = readCounter((await result.screen.findByRole('button', { name: /^2\s*\/\s*4$/ })).textContent)
      assert.deepEqual(afterTap, { text: '2 / 4', count: 2, computed: 4 })
    }
    const diagnosticCounts: Record<string, number> = {}
    for (const diagnostic of result.diagnostics()) {
      diagnosticCounts[diagnostic.level] = (diagnosticCounts[diagnostic.level] ?? 0) + 1
    }
    observation = { scenario, provider: 'headless', route, initial, ...(afterTap ? { afterTap } : {}), diagnosticCounts }
  }
  finally {
    await project.close()
  }
  return { ...observation, closed: true }
}
