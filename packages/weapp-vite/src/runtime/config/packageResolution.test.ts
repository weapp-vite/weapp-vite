import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { normalizeAliasOptions } from './internal/alias'

const roots: string[] = []

async function project() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(tmpdir(), 'config-package-resolution-'))))
  roots.push(root)
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'alias-consumer', type: 'module' }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist' }))
  await mkdir(path.join(root, 'src'))
  return root
}

async function installAliasPackage(root: string) {
  const packageRoot = path.join(root, 'node_modules/class-variance-authority')
  await mkdir(path.join(packageRoot, 'dist'), { recursive: true })
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'class-variance-authority', version: '1.0.0', main: 'dist/index.js' }))
  const entry = path.join(packageRoot, 'dist/index.js')
  await writeFile(entry, 'export const cva = () => "installed"')
  return entry
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('configuration package resolution ownership', () => {
  it('discovers a later installation on reload and resolves the nearest package when switching projects', async () => {
    const first = await project()
    const second = await project()
    const ctx = createCompilerContextInstance()
    const load = (cwd: string) => ctx.configService.load({
      cwd,
      hostConfig: { config: { weapp: { srcRoot: 'src' } } },
      emitDefaultAutoImportOutputs: false,
    })
    const resolved = () => normalizeAliasOptions(ctx.configService.mergeInlineConfig().resolve?.alias)
      .find(alias => alias.find === 'class-variance-authority')
      ?.replacement

    await load(first)
    expect(resolved()).toBeUndefined()
    const firstEntry = await installAliasPackage(first)
    await load(first)
    expect(resolved()).toBe(firstEntry)

    const secondEntry = await installAliasPackage(second)
    await load(second)
    expect(resolved()).toBe(secondEntry)
    await rm(path.join(second, 'node_modules'), { recursive: true })
    await load(second)
    expect(resolved()).toBeUndefined()
  })

  it('preserves user aliases when cached builtin entries are injected again', async () => {
    const root = await project()
    await installAliasPackage(root)
    const replacement = path.join(root, 'custom-cva.js')
    const ctx = createCompilerContextInstance()
    await ctx.configService.load({
      cwd: root,
      hostConfig: {
        config: {
          weapp: { srcRoot: 'src' },
          resolve: { alias: { 'class-variance-authority': replacement } },
        },
      },
      emitDefaultAutoImportOutputs: false,
    })
    const aliases = normalizeAliasOptions(ctx.configService.mergeInlineConfig().resolve?.alias)
    expect(aliases.filter(alias => alias.find === 'class-variance-authority')).toEqual([
      { find: 'class-variance-authority', replacement },
    ])
  })
})
