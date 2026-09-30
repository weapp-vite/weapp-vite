import type { MutableCompilerContext } from '../../context'
import type { MpPlatform } from '../../types'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { getPackNpmRelationList } from './relations'

function createContext(outputDirectory: string, manualDirectory?: string, platform: MpPlatform = 'weapp') {
  const cwd = path.resolve('npm-output-fixture')
  return {
    configService: {
      cwd,
      outDir: path.resolve(cwd, outputDirectory),
      platform,
      multiPlatform: { enabled: true },
      projectConfig: {
        miniprogramRoot: 'dist',
        setting: {
          packNpmManually: true,
          ...(manualDirectory === undefined
            ? {}
            : {
                packNpmRelationList: [{
                  packageJsonPath: './package.json',
                  miniprogramNpmDistDir: manualDirectory,
                }],
              }),
        },
      },
    },
  } as MutableCompilerContext
}

describe('multi-platform npm output', () => {
  it.each(['dist/weapp/dist', 'output/weapp'])('places default npm packages in resolved output %s', (outputDirectory) => {
    const ctx = createContext(outputDirectory)
    const [relation] = getPackNpmRelationList(ctx)

    expect(relation).toEqual({
      packageJsonPath: './package.json',
      miniprogramNpmDistDir: outputDirectory,
    })
    expect(path.resolve(ctx.configService!.cwd, relation.miniprogramNpmDistDir, 'miniprogram_npm'))
      .toBe(path.resolve(ctx.configService!.outDir, 'miniprogram_npm'))
  })

  it('preserves an absolute output outside the project directory', () => {
    const ctx = createContext('../external-weapp')

    expect(getPackNpmRelationList(ctx)).toEqual([{
      packageJsonPath: './package.json',
      miniprogramNpmDistDir: ctx.configService!.outDir,
    }])
  })

  it('preserves an explicit project-root npm relation', () => {
    const ctx = createContext('dist/weapp/dist', '.')

    expect(getPackNpmRelationList(ctx)).toEqual([{
      packageJsonPath: './package.json',
      miniprogramNpmDistDir: '.',
    }])
  })
})

it.each(['weapp', 'tt', 'swan', 'jd', 'xhs'] as const)('uses the resolved %s application output for default npm assets', (platform) => {
  const output = `dist/${platform}/dist`
  const ctx = createContext(output, undefined, platform)
  expect(getPackNpmRelationList(ctx)[0].miniprogramNpmDistDir).toBe(output)
})
