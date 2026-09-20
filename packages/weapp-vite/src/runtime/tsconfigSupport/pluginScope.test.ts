import type { MutableCompilerContext } from '../../context'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { transformWithOxc } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createManagedTsconfigFiles } from './index'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function fixture(pluginRoot: string, app: Record<string, unknown> = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-plugin-scope-'))
  roots.push(root)
  const project = path.join(root, 'templates/plugin')
  const files: Record<string, unknown> = {
    'tsconfig.json': { references: [{ path: './apps/unrelated' }] },
    'apps/unrelated/tsconfig.json': { extends: './missing-generated.json' },
    'templates/plugin/tsconfig.json': { references: [{ path: './.weapp-vite/tsconfig.app.json' }], files: [] },
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, JSON.stringify(content))
  }
  const ctx = {
    configService: {
      cwd: root,
      configFilePath: path.join(project, 'weapp-vite.config.ts'),
      packageJson: {},
      srcRoot: 'src',
      pluginRoot,
      weappViteConfig: { pluginRoot, typescript: { app } },
    },
  } as unknown as MutableCompilerContext
  const generated = await createManagedTsconfigFiles(ctx)
  for (const file of generated) {
    await fs.mkdir(path.dirname(file.path), { recursive: true })
    await fs.writeFile(file.path, file.content)
  }
  const config = JSON.parse(generated.find(file => file.path.endsWith('tsconfig.app.json'))!.content) as { include: string[], exclude?: string[] }
  return { project, config }
}

describe('managed plugin TypeScript scope', () => {
  it.each(['plugin', './custom/plugins/'])('keeps %s sources out of unrelated parent project references', async (pluginRoot) => {
    const { project, config } = await fixture(pluginRoot)
    const filename = path.resolve(project, pluginRoot, 'index.ts')
    const source = 'export const answer: number = 42'
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, source)
    expect(config.include).toContain(`${path.relative(path.join(project, '.weapp-vite'), path.dirname(filename))}/**/*`)
    await expect(transformWithOxc(source, filename, { lang: 'ts' })).resolves.toMatchObject({ code: expect.stringContaining('answer = 42') })
  })

  it('merges an explicit shared source directory and preserves user exclusions', async () => {
    const { project, config } = await fixture('plugin', { include: ['../shared/**/*'], exclude: ['../plugin/private/**'] })
    const filename = path.join(project, 'shared/index.ts')
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, 'export const shared: number = 1')
    expect(config.include).toContain('../src/**/*')
    expect(config.include).toContain('../plugin/**/*')
    expect(config.include).toContain('../shared/**/*')
    expect(config.exclude).toEqual(['../plugin/private/**'])
    await expect(transformWithOxc('export const shared: number = 1', filename, { lang: 'ts' })).resolves.toMatchObject({ code: expect.stringContaining('shared = 1') })
  })
})
