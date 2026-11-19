import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { expect, it } from 'vitest'
import { getPackNpmRelationList } from './relations'

it('relocates only relative manual npm mappings inside the original output tree', () => {
  const cwd = path.resolve('npm-mapping-fixture')
  const originalRoot = path.join(cwd, 'dist')
  const outputRoot = path.join(cwd, 'dist-demo')
  const values = ['./dist', './dist/packageA', './dist-other', '.', '../outside', originalRoot]
  const ctx = {
    configService: {
      cwd,
      platform: 'weapp',
      outDir: outputRoot,
      multiPlatform: { enabled: false },
      projectConfig: {
        miniprogramRoot: './dist/',
        setting: {
          packNpmManually: true,
          packNpmRelationList: values.map(miniprogramNpmDistDir => ({ packageJsonPath: './package.json', miniprogramNpmDistDir })),
        },
      },
    },
  } as MutableCompilerContext
  expect(getPackNpmRelationList(ctx, { defaultOutputRoot: outputRoot }).map(entry => entry.miniprogramNpmDistDir))
    .toEqual([outputRoot, path.join(outputRoot, 'packageA'), './dist-other', '.', '../outside', originalRoot])
  expect(ctx.configService!.projectConfig.setting!.packNpmRelationList.map(entry => entry.miniprogramNpmDistDir)).toEqual(values)
})
