import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { acceptanceInputManifest } from '../benchmarkTemplatesHmr/acceptanceRunner'
import { sha256 } from './artifacts'
import { INPUTS, parseOptions } from './contract'
import { captureIdentity, stageInput } from './stage'

it('preserves pnpm dependency resolution and cache writes through staged directory links', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-stage-')))
  const input = INPUTS[2]
  const source = path.join(root, input.source)
  const plugin = path.join(root, 'node_modules/.pnpm/native-stage-test-plugin@1.0.0/node_modules/native-stage-test-plugin')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'
  const write = async (file: string, value: string) => {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, value)
  }
  try {
    await write(path.join(root, 'packages/weapp-vite/package.json'), '{"name":"weapp-vite"}')
    await write(path.join(source, 'package.json'), '{"name":"staged-template"}')
    await write(path.join(source, 'weapp-vite.config.ts'), 'export default {}')
    await write(path.join(source, 'src/app.css'), '@plugin "native-stage-test-plugin";')
    await write(path.join(plugin, 'package.json'), '{"name":"native-stage-test-plugin","main":"lib/plugin.cjs"}')
    await write(path.join(plugin, 'lib/plugin.cjs'), 'module.exports = "original-plugin"')
    await mkdir(path.join(source, 'node_modules'))
    await symlink(path.join(root, 'packages/weapp-vite'), path.join(source, 'node_modules/weapp-vite'), linkType)
    await symlink(plugin, path.join(source, 'node_modules/native-stage-test-plugin'), linkType)
    const originalRequire = createRequire(path.join(source, 'package.json'))
    const originalPlugin = originalRequire.resolve('native-stage-test-plugin')
    const relativePlugin = path.relative(source, originalPlugin).replaceAll('\\', '/')
    const sourceDigest = sha256(JSON.stringify(await acceptanceInputManifest(source)))
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'native.node')])
    options.inputIdentities = { [input.source]: sourceDigest }

    const staged = await stageInput(options, input)
    const packageCache = path.join(root, 'packages/weapp-vite/.cache')
    for (const project of [source, staged.project]) {
      // 分别验证包链接，以及暂存 node_modules 链接叠加包链接时的首次写入和幂等创建。
      await rm(packageCache, { recursive: true, force: true })
      const cache = path.join(project, 'node_modules/weapp-vite/.cache')
      await mkdir(cache, { recursive: true })
      await writeFile(path.join(cache, '-.json'), JSON.stringify({ hash: 'staged-cache' }))
      await mkdir(cache, { recursive: true })
      expect(await realpath(cache)).toBe(await realpath(packageCache))
      expect(JSON.parse(await readFile(path.join(packageCache, '-.json'), 'utf8')) as unknown).toEqual({ hash: 'staged-cache' })
    }
    const hmrProject = path.join(staged.owned, 'hmr', input.id)
    await write(path.join(hmrProject, 'package.json'), '{"name":"hmr-template"}')
    for (const project of [staged.project, hmrProject]) {
      const require = createRequire(path.join(project, 'package.json'))
      expect(await realpath(require.resolve(relativePlugin))).toBe(await realpath(originalPlugin))
      expect(require(relativePlugin)).toBe('original-plugin')
    }
    expect(staged.sourceDigest).toBe(sourceDigest)
    expect(staged.manifest).not.toHaveProperty('node_modules')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('freezes templates and reused HMR/measurement drivers as well as product source and dist', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-identity-'))
  const write = async (relative: string, value = 'fixed') => {
    const file = path.join(root, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, value)
  }
  try {
    for (const packageRoot of ['packages/ast', 'packages/ast-native', 'packages/weapp-vite', 'packages-runtime/wevu-compiler', 'packages-runtime/wevu', '@weapp-core/constants']) {
      await write(`${packageRoot}/src/index.ts`)
      await write(`${packageRoot}/dist/index.mjs`)
    }
    for (const input of INPUTS) {
      await write(`${input.source}/src/page.ts`)
    }
    await write('scripts/benchmark-templates-hmr.ts')
    await write('scripts/benchmarkTemplatesPerformance/peakRssSampler.ts')
    await write('e2e/utils/dev-process.ts')
    await write('pnpm-lock.yaml')
    await write('pnpm-workspace.yaml')
    await write('package.json', '{}')
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'native.node')])
    const baseline = await captureIdentity(options)
    await write('scripts/benchmarkTemplatesPerformance/peakRssSampler.ts', 'changed')
    expect((await captureIdentity(options)).driver).not.toBe(baseline.driver)
    await write(`${INPUTS[0].source}/src/page.ts`, 'changed')
    expect((await captureIdentity(options))[INPUTS[0].source]).not.toBe(baseline[INPUTS[0].source])
    await write('e2e/utils/dev-process.ts', 'changed')
    expect((await captureIdentity(options)).devUtilities).not.toBe(baseline.devUtilities)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
