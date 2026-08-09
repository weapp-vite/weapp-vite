import type { CompilerContext } from '@/context'
import type { WatcherInstance } from '@/runtime/watcherPlugin'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createTempFixtureProject, createTestCompilerContext } from './utils'

vi.mock('@weapp-vite/web', () => ({
  weappWebPlugin: () => [],
}), { virtual: true })

interface WatcherEvent {
  code?: string
  error?: unknown
}

interface GeneratedJsFile {
  relativePath: string
  code: string
}

const WATCH_ASSERTION_TIMEOUT_MS = 90_000
const TEST_TIMEOUT_MS = 180_000
const WEVU_PACKAGE_ROOT = path.resolve(__dirname, '../../../packages-runtime/wevu')

type WatcherEmitter = WatcherInstance & {
  on: (event: 'event', listener: (event: WatcherEvent) => void) => void
  off?: (event: 'event', listener: (event: WatcherEvent) => void) => void
  removeListener?: (event: 'event', listener: (event: WatcherEvent) => void) => void
}

function isWatcherEmitter(value: unknown): value is WatcherEmitter {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as { on?: unknown, close?: unknown }
  return typeof candidate.on === 'function' && typeof candidate.close === 'function'
}

async function waitForBuild(watcher: WatcherEmitter, timeoutMs = WATCH_ASSERTION_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const seenEvents: string[] = []

    const unsubscribe = (fn: (event: WatcherEvent) => void) => {
      if (typeof watcher.off === 'function') {
        watcher.off('event', fn)
      }
      else if (typeof watcher.removeListener === 'function') {
        watcher.removeListener('event', fn)
      }
    }

    let timer: ReturnType<typeof setTimeout>
    const handler = (event: WatcherEvent) => {
      seenEvents.push(event.code ?? 'unknown')
      if (event.code === 'END' || event.code === 'BUNDLE_END') {
        clearTimeout(timer)
        unsubscribe(handler)
        resolve()
      }
      else if (event.code === 'ERROR') {
        clearTimeout(timer)
        unsubscribe(handler)
        reject(event.error ?? new Error('watch build failed'))
      }
    }

    timer = setTimeout(() => {
      unsubscribe(handler)
      reject(new Error(`watch build timed out, events seen: ${seenEvents.join(', ')}`))
    }, timeoutMs)

    watcher.on('event', handler)
  })
}

async function waitForFileSatisfies(
  filePath: string,
  predicate: (content: string) => boolean,
  label: string,
  timeoutMs = WATCH_ASSERTION_TIMEOUT_MS,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (predicate(content)) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  throw new Error(`watch build timed out, output did not satisfy: ${label}`)
}

async function readGeneratedJsFiles(root: string) {
  const files: GeneratedJsFile[] = []

  async function visit(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(filePath)
        continue
      }
      if (!entry.isFile() || !filePath.endsWith('.js')) {
        continue
      }
      files.push({
        relativePath: path.relative(root, filePath).replaceAll('\\', '/'),
        code: await fs.readFile(filePath, 'utf8'),
      })
    }
  }

  await visit(root)
  return files
}

async function installPublishedWevuPackage(projectRoot: string) {
  const targetRoot = path.resolve(projectRoot, 'node_modules/wevu')
  await fs.ensureDir(targetRoot)
  await Promise.all([
    fs.copy(path.resolve(WEVU_PACKAGE_ROOT, 'dist'), path.resolve(targetRoot, 'dist')),
    fs.copy(path.resolve(WEVU_PACKAGE_ROOT, 'package.json'), path.resolve(targetRoot, 'package.json')),
  ])
}

function expectNoBareWevuRuntimeReferences(code: string) {
  expect(code).not.toMatch(/\brequire\((['"`])wevu(?:\/internal-(?:runtime|reactivity|template))?\1\)/)
  expect(code).not.toMatch(/\bfrom\s*(['"`])wevu(?:\/internal-(?:runtime|reactivity|template))?\1/)
  expect(code).not.toContain('wevu/internal-runtime')
  expect(code).not.toContain('wevu/internal-reactivity')
  expect(code).not.toContain('wevu/internal-template')
}

function includesRelativeWevuVendorRequire(code: string) {
  return /\brequire\((['"])(?:\.\.?\/)+weapp-vendors\/wevu-[^'"]+\.js\1\)/.test(code)
}

function expectRelativeWevuVendorRequireForBinding(files: GeneratedJsFile[], bindingName: string) {
  const destructuredPattern = new RegExp([
    '\\bconst\\s*\\{[^}]*\\b',
    bindingName,
    '\\b[^}]*\\}\\s*=\\s*require\\((["\'])((?:\\.\\.?/)+weapp-vendors/wevu-[^\'"]+\\.js)\\1\\)',
  ].join(''), 'g')
  const namespaceRequirePattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*require\((["'])((?:\.\.?\/)+weapp-vendors\/wevu-[^'"]+\.js)\2\)/g
  const exportPattern = new RegExp(`\\bexports\\.${bindingName}\\b|Object\\.defineProperty\\(exports, ["']${bindingName}`)
  const filesByPath = new Map(files.map(file => [file.relativePath, file]))
  const requiredTargets: string[] = []

  for (const file of files) {
    if (!includesRelativeWevuVendorRequire(file.code)) {
      continue
    }
    for (const match of file.code.matchAll(destructuredPattern)) {
      const specifier = match[2]
      if (specifier) {
        requiredTargets.push(path.posix.normalize(path.posix.join(
          path.posix.dirname(file.relativePath),
          specifier,
        )))
      }
    }
    for (const match of file.code.matchAll(namespaceRequirePattern)) {
      const namespace = match[1]
      const specifier = match[3]
      if (namespace && specifier && new RegExp(`\\b${namespace}\\.${bindingName}\\b`).test(file.code)) {
        requiredTargets.push(path.posix.normalize(path.posix.join(
          path.posix.dirname(file.relativePath),
          specifier,
        )))
      }
    }
  }

  expect(requiredTargets).not.toEqual([])
  for (const target of requiredTargets) {
    expect(filesByPath.get(target)?.code, `${target} must export ${bindingName}`).toMatch(exportPattern)
  }
}

describe.sequential('wevu app runtime HMR', () => {
  it('keeps published app runtime imports resolved after editing a layout in dev watch mode', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'wevu-app-runtime-hmr')
    const cwd = tempProject.tempDir
    await installPublishedWevuPackage(cwd)
    const appSourcePath = path.resolve(cwd, 'src/app.vue')
    const layoutSourcePath = path.resolve(cwd, 'src/layouts/issue-398-shell.vue')

    const appSource = await fs.readFile(appSourcePath, 'utf8')
    await fs.writeFile(
      appSourcePath,
      appSource
        .replace(
          'import { onLaunch } from \'wevu\'',
          [
            'import { onLaunch, ref } from \'wevu\'',
            'import { normalizeClass } from \'wevu/internal-template\'',
          ].join('\n'),
        )
        .replace(
          'const tabBarList = [',
          [
            'const hmrProbeRef = ref(0)',
            'const hmrProbeClass = normalizeClass([\'wevu-hmr-probe\'])',
            'void hmrProbeRef',
            'void hmrProbeClass',
            '',
            'const tabBarList = [',
          ].join('\n'),
        ),
      'utf8',
    )
    const ctxResult: { ctx: CompilerContext, dispose: () => Promise<void> } = await createTestCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        build: {
          watch: {
            chokidar: {
              usePolling: true,
              interval: 100,
            },
          },
        },
      },
    })
    ctxResult.ctx.configService.weappViteConfig.hmr = { runtime: 'classic' }

    let watcher: WatcherEmitter | undefined

    try {
      const buildResult = await ctxResult.ctx.buildService.build({ skipNpm: true })
      if (!isWatcherEmitter(buildResult)) {
        throw new Error('Expected watch mode build to return a watcher')
      }
      watcher = buildResult

      const appOutputPath = path.resolve(ctxResult.ctx.configService.outDir, 'app.js')
      const layoutOutputPath = path.resolve(ctxResult.ctx.configService.outDir, 'layouts/issue-398-shell.wxml')
      const runtimeVendorPath = path.resolve(ctxResult.ctx.configService.outDir, 'weapp-vendors/wevu-runtime.js')
      const reactivityVendorPath = path.resolve(ctxResult.ctx.configService.outDir, 'weapp-vendors/wevu-reactivity.js')
      const templateVendorPath = path.resolve(ctxResult.ctx.configService.outDir, 'weapp-vendors/wevu-template.js')

      const initialAppOutput = await waitForFileSatisfies(
        appOutputPath,
        content => content.includes('wevu-hmr-probe'),
        'initial app output contains hmr probe',
      )
      const initialGeneratedJsFiles = await readGeneratedJsFiles(ctxResult.ctx.configService.outDir)
      const initialVendorPaths = initialGeneratedJsFiles
        .map(file => file.relativePath)
        .filter(relativePath => relativePath.startsWith('weapp-vendors/'))
        .sort()
      expectNoBareWevuRuntimeReferences(initialAppOutput)
      expect(await fs.pathExists(runtimeVendorPath)).toBe(true)
      expect(await fs.pathExists(reactivityVendorPath)).toBe(true)
      expect(
        await fs.pathExists(templateVendorPath),
        `generated vendor files: ${initialVendorPaths.join(', ')}`,
      ).toBe(true)

      const originalLayoutSource = await fs.readFile(layoutSourcePath, 'utf8')
      const updatedLayoutSource = originalLayoutSource.replace(
        '<view class="issue-398-shell">',
        '<view class="issue-398-shell wevu-hmr-layout-updated">',
      )
      expect(updatedLayoutSource).not.toBe(originalLayoutSource)

      const buildPromise = waitForBuild(watcher)
      await fs.writeFile(layoutSourcePath, updatedLayoutSource, 'utf8')
      await buildPromise

      await waitForFileSatisfies(
        layoutOutputPath,
        content => content.includes('wevu-hmr-layout-updated'),
        'updated layout output contains hmr marker',
      )
      const updatedAppOutput = await waitForFileSatisfies(
        appOutputPath,
        content => content.includes('wevu-hmr-probe'),
        'updated app output contains hmr probe',
      )
      const generatedJsFiles = await readGeneratedJsFiles(ctxResult.ctx.configService.outDir)

      expectRelativeWevuVendorRequireForBinding(generatedJsFiles, 'setWevuDefaults')
      expectRelativeWevuVendorRequireForBinding(generatedJsFiles, 'ref')
      expectNoBareWevuRuntimeReferences(updatedAppOutput)
    }
    finally {
      await watcher?.close()
      await ctxResult.dispose()
      await tempProject.cleanup()
    }
  }, TEST_TIMEOUT_MS)
})
