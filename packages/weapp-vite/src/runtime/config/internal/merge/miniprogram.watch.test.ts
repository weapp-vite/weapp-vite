import type { MutableCompilerContext } from '../../../../context'
import picomatch from 'picomatch'
import { expect, it, vi } from 'vitest'
import { mergeMiniprogram } from './miniprogram'

vi.mock('./plugins', () => ({ arrangePlugins: vi.fn() }))

it.each([
  { cwd: '/project', output: undefined, emitted: '/project/dist/index.js' },
  { cwd: '/project', output: 'dist-plugin', emitted: '/project/dist-plugin/index.js' },
  { cwd: '/project', output: '/project/dist/plugin', emitted: '/project/dist/plugin/index.js' },
  { cwd: '/project', output: '/output/plugin', emitted: '/output/plugin/index.js' },
  { cwd: 'C:/project', output: 'D:/plugin-output', emitted: 'D:/plugin-output/index.js' },
])('excludes emitted files from watch when output is $output in $cwd', ({ cwd, output, emitted }) => {
  const result = mergeMiniprogram({
    ctx: { configService: { platform: 'weapp' } } as MutableCompilerContext,
    subPackageMeta: undefined,
    config: { build: { watch: { exclude: ['**/custom-ignore/**'] } } },
    cwd,
    srcRoot: 'src',
    mpDistRoot: output,
    packageJson: undefined,
    isDev: true,
    applyRuntimePlatform: vi.fn(),
    injectBuiltinAliases: vi.fn(),
    getDefineImportMetaEnv: () => ({}),
    setOptions: vi.fn(),
    oxcRolldownPlugin: undefined,
  })
  const watch = result.build?.watch
  expect(watch).toBeTruthy()
  if (!watch) {
    throw new Error('Expected a development watcher')
  }
  const excluded = picomatch([watch.exclude].flat().filter((pattern): pattern is string => typeof pattern === 'string'))
  expect(excluded(emitted)).toBe(true)
  expect(excluded(`${cwd}/custom-ignore/generated.js`)).toBe(true)
  expect(excluded(`${cwd}/src/index.ts`)).toBe(false)
  expect(excluded(`${cwd}/shared/message.ts`)).toBe(false)
})
