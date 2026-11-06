import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeBundlerScriptInput } from './bundlerSourceInput'
import { observeCompilerInputs } from './sourceSnapshot'

const roots: string[] = []
const releases: Array<() => void> = []

function fixture() {
  const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'bundler-input-path-')))
  roots.push(root)
  const files = ['first', 'second'].map((name) => {
    const directory = path.join(root, name)
    mkdirSync(directory)
    const file = path.join(directory, 'source.ts')
    writeFileSync(file, `export const value = '${name}'`)
    return file.replaceAll('\\', '/')
  })
  const alias = path.join(root, 'alias')
  symlinkSync(path.dirname(files[0]!), alias, 'junction')
  const owner = { configService: {} }
  const observe = vi.fn<(id: string, source: string) => void>()
  const release = observeCompilerInputs(owner.configService, observe)
  releases.push(release)
  return { root, files, alias, request: path.join(alias, 'source.ts'), owner, observe, release }
}

afterEach(() => {
  vi.restoreAllMocks()
  releases.splice(0).forEach(release => release())
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }))
})

describe('bundler input path identity', () => {
  it.each(['physical', 'alias'] as const)('resolves the %s input once for ownership and notification', (kind) => {
    const { files, request, owner, observe } = fixture()
    const id = kind === 'alias' ? request : files[0]!
    const native = vi.spyOn(realpathSync, 'native')

    observeBundlerScriptInput(owner, 'delivered input', id)

    expect(observe).toHaveBeenCalledExactlyOnceWith(files[0], 'delivered input')
    expect(native).toHaveBeenCalledExactlyOnceWith(id.replaceAll('\\', '/'))
  })

  it('releases successful identities before the next alias replacement or deletion', () => {
    const { files, alias, request, owner, observe } = fixture()
    observeBundlerScriptInput(owner, 'first', request)
    unlinkSync(alias)
    symlinkSync(path.dirname(files[1]!), alias, 'junction')
    observeBundlerScriptInput(owner, 'second', request)
    unlinkSync(files[1]!)
    observeBundlerScriptInput(owner, 'removed', request)
    writeFileSync(files[1]!, 'recreated')
    observeBundlerScriptInput(owner, 'recreated', request)

    expect(observe.mock.calls).toEqual([
      [files[0], 'first'],
      [files[1], 'second'],
      [files[1], 'removed'],
      [files[1], 'recreated'],
    ])
  })

  it('releases the identity scope when an observer throws', () => {
    const { files, alias, request, owner, observe } = fixture()
    observe.mockImplementationOnce(() => {
      throw new Error('observer failure')
    })
    expect(() => observeBundlerScriptInput(owner, 'first', request)).toThrow('observer failure')
    unlinkSync(alias)
    symlinkSync(path.dirname(files[1]!), alias, 'junction')
    const native = vi.spyOn(realpathSync, 'native')

    observeBundlerScriptInput(owner, 'second', request)

    expect(observe).toHaveBeenLastCalledWith(files[1], 'second')
    expect(native).toHaveBeenCalledExactlyOnceWith(request.replaceAll('\\', '/'))
  })

  it('skips identity reads after release and preserves a replacement observer', () => {
    const { files, request, owner, observe, release } = fixture()
    release()
    const native = vi.spyOn(realpathSync, 'native')
    observeBundlerScriptInput(owner, 'released', request)
    expect(native).not.toHaveBeenCalled()
    const replacement = vi.fn()
    releases.push(observeCompilerInputs(owner.configService, replacement))
    release()

    observeBundlerScriptInput(owner, 'replacement', request)

    expect(observe).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledExactlyOnceWith(files[0], 'replacement')
    expect(native).toHaveBeenCalledExactlyOnceWith(request.replaceAll('\\', '/'))
  })
})
