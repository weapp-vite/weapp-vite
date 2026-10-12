import type { OutputBundle } from 'rolldown'
import type { MutableCompilerContext } from '../../../context'
import type { RemoveImplicitPagePreloadOptions } from './types'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfigService } from '../../../runtime/config/createConfigService'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { removeImplicitPagePreloads } from './bundle'

const temporaryRoots: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createFixture() {
  const root = path.normalize(realpathSync.native(mkdtempSync(path.join(tmpdir(), 'preload-path-'))))
  temporaryRoots.push(root)
  const srcRoot = path.join(root, 'src')
  mkdirSync(srcRoot)
  const runtimeState = createRuntimeState()
  Object.assign(runtimeState.config.options, { cwd: root, srcRoot: 'src' })
  const ctx = { runtimeState } as unknown as MutableCompilerContext
  const configService = createConfigService(ctx)
  const write = (file: string) => {
    const id = path.join(srcRoot, file)
    mkdirSync(path.dirname(id), { recursive: true })
    writeFileSync(id, 'Page({})')
    return id
  }
  const remove = (ids: string[], outputFiles: string[]) => {
    const app = {
      type: 'chunk',
      fileName: 'app.js',
      code: [...outputFiles.map((file, index) => `const preload${index} = require("./${file}");`), 'require("./runtime.js");', 'App({})'].join('\n'),
      imports: [...outputFiles, 'runtime.js'],
      implicitlyLoadedBefore: [...outputFiles, 'runtime.js'],
    }
    const bundle = {
      'app.js': app,
      'runtime.js': { type: 'chunk', fileName: 'runtime.js', code: 'module.exports = {}', imports: [] },
      ...Object.fromEntries(outputFiles.map(fileName => [fileName, {
        type: 'chunk',
        fileName,
        code: 'Page({})',
        imports: [],
      }])),
    } as unknown as OutputBundle
    const entriesMap = new Map(ids.map((id, index) => [String(index), { path: id, type: 'page' }])) as RemoveImplicitPagePreloadOptions['entriesMap']
    removeImplicitPagePreloads(bundle, { configService, entriesMap })
    expect(app.code.trim()).toBe('require("./runtime.js");\nApp({})')
    expect(app.imports).toEqual(['runtime.js'])
    expect(app.implicitlyLoadedBefore).toEqual(['runtime.js'])
  }
  return { configService, srcRoot, write, remove }
}

describe('implicit page preload path scope', () => {
  it('shares successful source root reads while preserving removed preloads', () => {
    const fixture = createFixture()
    const ids = ['first', 'second'].map(name => fixture.write(`pages/${name}.ts`))
    const outputFiles = ['pages/first.js', 'pages/second.js']
    const native = vi.spyOn(realpathSync, 'native')

    fixture.remove(ids, outputFiles)
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(1)
    for (const id of ids) {
      expect(native.mock.calls.filter(([file]) => file === id)).toHaveLength(1)
    }
    fixture.remove(ids, outputFiles)
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(2)
  })

  it('rereads page symlinks redirected before the next bundle', () => {
    const fixture = createFixture()
    fixture.write('first/page.ts')
    fixture.write('second/page.ts')
    const link = path.join(fixture.srcRoot, 'shared')
    symlinkSync(path.join(fixture.srcRoot, 'first'), link, 'junction')
    const ids = [path.join(link, 'page.ts')]

    fixture.remove(ids, ['first/page.js'])
    unlinkSync(link)
    symlinkSync(path.join(fixture.srcRoot, 'second'), link, 'junction')
    fixture.remove(ids, ['second/page.js'])
  })

  it('rereads missing page paths created before the next bundle', () => {
    const fixture = createFixture()
    const link = path.join(fixture.srcRoot, 'later')
    const ids = [path.join(link, 'page.ts')]

    fixture.remove(ids, ['later/page.js'])
    fixture.write('created/page.ts')
    symlinkSync(path.join(fixture.srcRoot, 'created'), link, 'junction')
    fixture.remove(ids, ['created/page.js'])
  })

  it('propagates path errors and releases successful reads after an aborted collection', () => {
    const fixture = createFixture()
    const ids = ['first', 'second'].map(name => fixture.write(`pages/${name}.ts`))
    const relative = fixture.configService.relativeAbsoluteSrcRoot.bind(fixture.configService)
    const failure = new Error('page path unavailable')
    const mapping = vi.spyOn(fixture.configService, 'relativeAbsoluteSrcRoot')
      .mockImplementationOnce(relative)
      .mockImplementationOnce(() => { throw failure })
    const native = vi.spyOn(realpathSync, 'native')

    expect(() => fixture.remove(ids, ['pages/first.js', 'pages/second.js'])).toThrow(failure)
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(1)
    mapping.mockRestore()
    fixture.remove(ids, ['pages/first.js', 'pages/second.js'])
    expect(native.mock.calls.filter(([file]) => file === fixture.srcRoot)).toHaveLength(2)
  })
})
