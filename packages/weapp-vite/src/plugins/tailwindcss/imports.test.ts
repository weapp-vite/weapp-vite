import type { PluginContext } from 'rolldown'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findManagedStyleImports } from './imports'

describe('managed style import ownership', () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  })

  it.each(['wxss', 'acss', 'ttss'])('resolves relative native %s imports before reading their dependencies', async (extension) => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-imports-')))
    roots.push(root)
    const nativeStyle = path.join(root, `common.${extension}`)
    const entry = path.join(root, 'tailwind.css')
    await fs.writeFile(nativeStyle, '@import "./tailwind.css";')
    const resolve = vi.fn(async (request: string, importer: string) => ({
      id: request.endsWith(`.${extension}`)
        ? request.replace(`.${extension}`, `.css?nativeStyle=${extension}`)
        : path.resolve(path.dirname(importer), request),
      external: false,
    }))

    const result = await findManagedStyleImports(`@import "./common.${extension}";`, path.join(root, 'app.css'), {
      resolve: resolve as unknown as PluginContext['resolve'],
      isManaged: file => file === entry,
    })

    expect(result.managed).toBe(true)
    expect(result.dependencies).toEqual(new Set([nativeStyle, entry]))
    expect(resolve).toHaveBeenCalledWith('./tailwind.css', nativeStyle, { skipSelf: true })
  })

  it('keeps ordinary native styles unmanaged and terminates cyclic imports', async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-style-imports-')))
    roots.push(root)
    const nativeStyle = path.join(root, 'common.wxss')
    await fs.writeFile(nativeStyle, '@import "./common.wxss"; .native { color: red; }')
    const result = await findManagedStyleImports('@import "./common.wxss";', path.join(root, 'app.css'), {
      resolve: vi.fn(async () => ({ id: './common.css?nativeStyle=wxss', external: false })) as unknown as PluginContext['resolve'],
      isManaged: () => false,
    })

    expect(result.managed).toBe(false)
    expect(result.dependencies).toEqual(new Set([nativeStyle]))
  })
})
