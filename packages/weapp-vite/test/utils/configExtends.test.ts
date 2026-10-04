import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { parse } from 'comment-json'
import { parseTsconfig } from 'get-tsconfig'
import path from 'pathe'
import { transformWithOxc } from 'vite'
import { describe, expect, it } from 'vitest'
import { rebaseTempConfigExtends, toConfigExtendsPath } from '../../../../scripts/testFixtures/configExtends'

async function fixture(run: (root: string, source: string, target: string) => Promise<void>, targetLayout = 'apps/temporary/copy') {
  const root = await mkdtemp(path.join(tmpdir(), 'fixture-config-'))
  const source = path.join(root, 'apps/example')
  const target = path.join(root, targetLayout)
  try {
    await mkdir(source, { recursive: true })
    await run(root, source, target)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('temporary fixture config extends', () => {
  it.each([
    ['C:/temporary/project/tsconfig.json', 'D:/workspace/tsconfig.base.json', 'D:/workspace/tsconfig.base.json'],
    ['C:/temporary/project/tsconfig.json', 'C:/workspace/tsconfig.base.json', '../../workspace/tsconfig.base.json'],
    ['/temporary/project/tsconfig.json', '/temporary/project/config/base.json', './config/base.json'],
  ])('preserves config path semantics from %s to %s', (configFile, baseFile, expected) => {
    expect(toConfigExtendsPath(configFile, baseFile)).toBe(expected)
  })

  it.each(['apps/temporary/copy', 'temporary/e2e-projects/github-issues/scenario'])('rebases nested JSONC config chains before Oxc transforms config imports in %s', async (targetLayout) => {
    await fixture(async (root, source, target) => {
      await writeFile(path.join(root, 'compiler.json'), JSON.stringify({ compilerOptions: { strict: true, paths: { '@shared/*': ['./shared/*'] } } }))
      await writeFile(path.join(root, 'tsconfig.base.json'), JSON.stringify({ extends: './compiler.json' }))
      await writeFile(path.join(source, 'tsconfig.json'), JSON.stringify({ files: [], references: [{ path: './config' }] }))
      await mkdir(path.join(source, 'config'))
      const configSource = '{\n  // Node config imports use the workspace settings.\n  "extends": "../../../tsconfig.base.json",\n  "compilerOptions": { "types": ["node"] },\n}\n'
      await writeFile(path.join(source, 'config/tsconfig.json'), configSource)
      await cp(source, target, { recursive: true })
      const configFile = path.join(target, 'config/tsconfig.json')
      const code = 'export const marker: string = "config-transform-ready"'
      const filename = path.join(target, 'config/entry.ts')

      await expect(transformWithOxc(code, filename)).rejects.toThrow('Tsconfig not found')
      const parentEntries = await readdir(path.dirname(target))
      await rebaseTempConfigExtends(source, target)

      expect(parseTsconfig(configFile).compilerOptions).toEqual(parseTsconfig(path.join(source, 'config/tsconfig.json')).compilerOptions)
      await expect(transformWithOxc(code, filename)).resolves.toMatchObject({ code: expect.stringContaining('config-transform-ready') })
      expect(await readFile(path.join(source, 'config/tsconfig.json'), 'utf8')).toBe(configSource)
      expect(await readFile(configFile, 'utf8')).toContain('// Node config imports use the workspace settings.')
      expect(await readdir(path.dirname(target))).toEqual(parentEntries)
      expect(existsSync(path.join(root, 'apps/tsconfig.base.json'))).toBe(false)
    }, targetLayout)
  })

  it('preserves package and internal array entries while rebasing nonstandard internal base files', async () => {
    await fixture(async (root, source, target) => {
      await writeFile(path.join(root, 'tsconfig.base.json'), '{}')
      await mkdir(path.join(source, 'config'))
      await writeFile(path.join(source, 'tsconfig.json'), JSON.stringify({ extends: ['@scope/config', './config/base'] }))
      await writeFile(path.join(source, 'jsconfig.json'), JSON.stringify({ extends: '../../tsconfig.base.json' }))
      await writeFile(path.join(source, 'config/base.json'), JSON.stringify({ extends: '../../../tsconfig.base.json' }))
      await cp(source, target, { recursive: true })

      await rebaseTempConfigExtends(source, target)

      const rootConfig = parse(await readFile(path.join(target, 'tsconfig.json'), 'utf8')) as unknown as { extends: string[] }
      expect(rootConfig.extends).toEqual(['@scope/config', './config/base'])
      for (const relative of ['jsconfig.json', 'config/base.json']) {
        const file = path.join(target, relative)
        const config = parse(await readFile(file, 'utf8')) as unknown as { extends: string }
        expect(path.isAbsolute(config.extends)).toBe(false)
        expect(path.resolve(path.dirname(file), config.extends)).toBe(path.join(root, 'tsconfig.base.json'))
      }
    })
  })
})
