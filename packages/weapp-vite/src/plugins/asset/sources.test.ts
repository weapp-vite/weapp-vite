import type { CompilerContext } from '../../context'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it, vi } from 'vitest'
import { createAssetSourcePlan } from './sources'

it('shares source/plugin copy selection across root-relative patterns, exclusions, filters and hidden files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'asset-sources-'))
  try {
    const config = {
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      absolutePluginRoot: path.join(root, 'plugin'),
      weappViteConfig: { copy: {
        include: ['src/**/*.txt', '**/.explicit.txt'],
        exclude: ['**/excluded.*'],
        filter: (file: string) => !file.endsWith('filtered.png'),
      } },
    } as unknown as CompilerContext['configService']
    for (const file of ['src/a.png', 'src/a.txt', 'src/excluded.png', 'src/filtered.png', 'src/.hidden.png', 'src/.explicit.txt', 'src/output/b.png', 'src/node_modules/c.png', 'plugin/plugin.png']) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), file)
    }
    const originalFilter = config.weappViteConfig.copy!.filter!
    const filter = vi.fn(originalFilter)
    config.weappViteConfig.copy!.filter = filter
    const source = createAssetSourcePlan(config, 'src/output', 'app')
    expect((await source.scan()).map(file => path.relative(root, file)).sort()).toEqual(['src/.explicit.txt', 'src/a.png', 'src/a.txt'])
    expect(filter.mock.calls.every(([, index, array]) => Number.isInteger(index) && array.length === 4)).toBe(true)
    expect(filter.mock.calls.every(([file, index, array]) => array[index] === file)).toBe(true)
    expect(source.matchesPath(path.join(root, 'unrelated.png'))).toBe(false)
    expect(source.matchesPath(path.join(root, 'src-other/a.png'))).toBe(false)
    const plugin = createAssetSourcePlan(config, 'dist', 'plugin')
    expect((await plugin.scan()).map(file => path.relative(root, file))).toEqual(['plugin/plugin.png'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
