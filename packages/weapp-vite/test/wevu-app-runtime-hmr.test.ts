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

async function waitForBuild(watcher: WatcherEmitter, timeoutMs = 45_000) {
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
  timeoutMs = 45_000,
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
  const destructuredPattern = [
    '\\bconst\\s*\\{[^}]*\\b',
    bindingName,
    '\\b[^}]*\\}\\s*=\\s*require\\((["\'])(?:\\.\\.?/)+weapp-vendors/wevu-[^\'"]+\\.js\\1\\)',
  ].join('')
  const namespaceRequirePattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*require\((["'])(?:\.\.?\/)+weapp-vendors\/wevu-[^'"]+\.js\2\)/g
  const bindingPattern = new RegExp(`\\b${bindingName}\\b`)
  const exportPattern = new RegExp(`\\bexports\\.${bindingName}\\b|Object\\.defineProperty\\(exports, ["']${bindingName}`)
  const matchedFiles = files.filter(({ code }) => {
    if (!includesRelativeWevuVendorRequire(code) || !bindingPattern.test(code)) {
      return false
    }
    if (new RegExp(destructuredPattern).test(code)) {
      return true
    }
    for (const match of code.matchAll(namespaceRequirePattern)) {
      const namespace = match[1]
      if (new RegExp(`\\b${namespace}\\.${bindingName}\\b`).test(code)) {
        return true
      }
    }
    return exportPattern.test(code)
  })

  expect(matchedFiles.map(file => file.relativePath)).not.toEqual([])
}

describe.sequential('wevu app runtime HMR', () => {
  it('keeps app runtime imports resolved after editing a layout in dev watch mode', async () => {
    const fixtureSource = path.resolve(__dirname, '../../../e2e-apps/github-issues')
    const tempProject = await createTempFixtureProject(fixtureSource, 'wevu-app-runtime-hmr')
    const cwd = tempProject.tempDir
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

    let watcher: WatcherEmitter | undefined

    try {
      const buildResult = await ctxResult.ctx.buildService.build({ skipNpm: true })
      if (!isWatcherEmitter(buildResult)) {
        throw new Error('Expected watch mode build to return a watcher')
      }
      watcher = buildResult

      const appOutputPath = path.resolve(ctxResult.ctx.configService.outDir, 'app.js')
      const layoutOutputPath = path.resolve(ctxResult.ctx.configService.outDir, 'layouts/issue-398-shell.wxml')

      const initialAppOutput = await waitForFileSatisfies(
        appOutputPath,
        content => content.includes('wevu-hmr-probe'),
        'initial app output contains hmr probe',
      )
      expectNoBareWevuRuntimeReferences(initialAppOutput)

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
  }, 120_000)
})
