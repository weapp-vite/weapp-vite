import type { MutableCompilerContext } from '../../context'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createConfigService } from './createConfigService'

const roots: string[] = []

function fixture() {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(tmpdir(), 'output-path-scope-'))).replaceAll('\\', '/')
  roots.push(root)
  const src = path.join(root, 'src')
  const plugin = path.join(root, 'plugin')
  const packageRoot = path.join(root, 'node_modules/ui')
  for (const directory of [src, plugin, packageRoot]) {
    fs.mkdirSync(directory, { recursive: true })
  }
  const file = path.join(packageRoot, 'card.vue')
  fs.writeFileSync(file, '<template />')
  const runtimeState = createRuntimeState()
  Object.assign(runtimeState.config.options, {
    cwd: root,
    srcRoot: 'src',
    mpDistRoot: 'dist',
    config: { weapp: { pluginRoot: 'plugin' } },
    projectConfig: { pluginRoot: 'dist/plugin-output' },
  })
  const service = createConfigService({ runtimeState } as MutableCompilerContext)
  return { root, src, plugin, packageRoot, file, service }
}

afterEach(() => {
  vi.restoreAllMocks()
  roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }))
})

describe('output path planning identity', () => {
  it('shares a successful external target across source-root checks and namespace mapping', () => {
    const { root, src, plugin, file, service } = fixture()
    const native = vi.spyOn(fs.realpathSync, 'native')

    expect(service.relativeOutputPath(file)).toBe('weapp_vite_external/ui/card.vue')

    for (const input of [file, src, plugin, root]) {
      expect(native.mock.calls.filter(([value]) => value === input)).toHaveLength(1)
    }
  })

  it('shares an existing parent for extensionless outputs without caching a failed target', () => {
    const { root, src, plugin, packageRoot, service } = fixture()
    const missing = path.join(packageRoot, 'card')
    const native = vi.spyOn(fs.realpathSync, 'native')

    expect(service.relativeOutputPath(missing)).toBe('weapp_vite_external/ui/card')

    expect(native.mock.calls.filter(([input]) => input === missing)).toHaveLength(2)
    for (const input of [packageRoot, src, plugin, root]) {
      expect(native.mock.calls.filter(([value]) => value === input)).toHaveLength(1)
    }
  })

  it('observes a target created by the relative-path override during the same operation', () => {
    const { packageRoot, service } = fixture()
    const created = path.join(packageRoot, 'created')
    const receiver = {
      ...service,
      relativeAbsoluteSrcRoot(input: string) {
        const relative = service.relativeAbsoluteSrcRoot(input)
        fs.writeFileSync(input, 'created')
        return relative
      },
    }
    const native = vi.spyOn(fs.realpathSync, 'native')

    expect(service.relativeOutputPath.call(receiver, created)).toBe('weapp_vite_external/ui/created')

    const targetResults = native.mock.results.filter((_result, index) => native.mock.calls[index]?.[0] === created)
    expect(targetResults.map(result => result.type)).toEqual(['throw', 'return'])
  })

  it('refreshes the target and configuration roots before the next operation', () => {
    const { root, service } = fixture()
    const targets = ['first', 'second'].map((name) => {
      const directory = path.join(root, 'node_modules', name)
      fs.mkdirSync(directory)
      fs.writeFileSync(path.join(directory, 'card.vue'), '<template />')
      return directory
    })
    const alias = path.join(root, 'node_modules/linked')
    fs.symlinkSync(targets[0]!, alias, 'junction')
    const request = path.join(alias, 'card.vue')
    expect(service.relativeOutputPath(request)).toBe('weapp_vite_external/first/card.vue')
    fs.unlinkSync(alias)
    fs.symlinkSync(targets[1]!, alias, 'junction')
    expect(service.relativeOutputPath(request)).toBe('weapp_vite_external/second/card.vue')
    service.options.srcRoot = 'node_modules/second'

    expect(service.relativeOutputPath(request)).toBe('card.vue')
  })

  it('preserves the receiver relative-path override without probing unrelated roots', () => {
    const { file, service } = fixture()
    const relativeAbsoluteSrcRoot = vi.fn(() => 'custom/card.vue')
    const receiver = { ...service, relativeAbsoluteSrcRoot }
    const native = vi.spyOn(fs.realpathSync, 'native')

    expect(service.relativeOutputPath.call(receiver, file)).toBe('custom/card.vue')

    expect(relativeAbsoluteSrcRoot).toHaveBeenCalledExactlyOnceWith(file)
    expect(native).not.toHaveBeenCalled()
  })
})
