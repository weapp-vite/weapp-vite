import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { acceptanceInputManifest } from '../benchmarkTemplatesHmr/acceptanceRunner'
import { sha256 } from './artifacts'
import { INPUTS, parseOptions } from './contract'
import { captureIdentity, stageDependencies, stageInput } from './stage'

it('preserves relative pnpm links, direct cache writes and root-relative HMR plugin resolution', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-stage-')))
  const input = INPUTS[2]
  const source = path.join(root, input.source)
  const plugin = path.join(root, 'node_modules/.pnpm/native-stage-test-plugin@1.0.0/node_modules/native-stage-test-plugin')
  const scopedPackage = path.join(root, 'packages/scoped-dependency')
  const sourceModules = path.join(source, 'node_modules')
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
    await write(path.join(scopedPackage, 'package.json'), '{"name":"@native-stage/scoped-dependency"}')
    await write(path.join(sourceModules, '.modules.yaml'), 'layout: original')
    await write(path.join(sourceModules, '.bin/native-stage-test'), 'original-command')
    await mkdir(path.join(sourceModules, '@native-stage'))
    const links = [
      ['weapp-vite', path.join(root, 'packages/weapp-vite')],
      ['native-stage-test-plugin', plugin],
      ['@native-stage/scoped-dependency', scopedPackage],
    ] as const
    for (const [name, target] of links) {
      const link = path.join(sourceModules, name)
      // 与 pnpm 相同的真实相对 symlink；Windows 无权限时必须失败，不能改成绝对 junction 或跳过。
      await symlink(path.relative(path.dirname(link), target), link, 'dir')
    }
    await symlink('../packages/weapp-vite', path.join(root, 'node_modules/weapp-vite'), 'dir')
    const originalLinks = await Promise.all(links.map(([name]) => readlink(path.join(sourceModules, name))))
    expect(originalLinks.every(link => !path.isAbsolute(link))).toBe(true)
    const originalRequire = createRequire(path.join(source, 'package.json'))
    const originalPlugin = originalRequire.resolve('native-stage-test-plugin')
    const relativePlugin = path.relative(source, originalPlugin).replaceAll('\\', '/')
    const sourceDigest = sha256(JSON.stringify(await acceptanceInputManifest(source)))
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'native.node')])
    options.inputIdentities = { [input.source]: sourceDigest }

    const staged = await stageInput(options, input)
    // 所有平台都执行 Windows 布局策略，真实 Windows runner 另验证系统解析语义。
    const windowsOwned = path.join(root, 'windows-layout')
    const windowsProject = path.join(windowsOwned, 'input', input.id)
    await write(path.join(windowsProject, 'package.json'), '{"name":"windows-staged-template"}')
    await stageDependencies(sourceModules, path.join(windowsProject, 'node_modules'), 'win32')
    await stageDependencies(path.join(root, 'node_modules'), path.join(windowsOwned, 'node_modules'), 'win32')
    expect((await lstat(path.join(windowsProject, 'node_modules'))).isSymbolicLink()).toBe(false)
    expect((await lstat(path.join(windowsProject, 'node_modules/@native-stage'))).isSymbolicLink()).toBe(false)
    expect((await lstat(path.join(windowsOwned, 'node_modules/.pnpm'))).isSymbolicLink()).toBe(true)
    expect(path.isAbsolute(await readlink(path.join(windowsOwned, 'node_modules/weapp-vite')))).toBe(true)
    expect(await realpath(path.join(windowsOwned, 'node_modules/weapp-vite/package.json'))).toBe(await realpath(path.join(root, 'packages/weapp-vite/package.json')))
    for (const [name, target] of links) {
      const link = path.join(windowsProject, 'node_modules', name)
      expect(path.isAbsolute(await readlink(link))).toBe(true)
      expect(await realpath(link)).toBe(await realpath(target))
    }
    expect(await readFile(path.join(windowsProject, 'node_modules/.modules.yaml'), 'utf8')).toBe('layout: original')
    expect(await readFile(path.join(windowsProject, 'node_modules/.bin/native-stage-test'), 'utf8')).toBe('original-command')
    const packageCache = path.join(root, 'packages/weapp-vite/.cache')
    for (const project of [source, staged.project, windowsProject]) {
      const require = createRequire(path.join(project, 'package.json'))
      expect(await realpath(path.join(project, 'node_modules/weapp-vite/package.json'))).toBe(await realpath(path.join(root, 'packages/weapp-vite/package.json')))
      expect(await realpath(require.resolve('@native-stage/scoped-dependency/package.json'))).toBe(await realpath(path.join(scopedPackage, 'package.json')))
      // 直接验证实际缓存路径的首次写入和幂等创建，不能用 Node 的祖先依赖回退掩盖断链。
      await rm(packageCache, { recursive: true, force: true })
      const cache = path.join(project, 'node_modules/weapp-vite/.cache')
      await mkdir(cache, { recursive: true })
      await writeFile(path.join(cache, '-.json'), JSON.stringify({ hash: 'staged-cache' }))
      await mkdir(cache, { recursive: true })
      expect(await realpath(cache)).toBe(await realpath(packageCache))
      expect(JSON.parse(await readFile(path.join(packageCache, '-.json'), 'utf8')) as unknown).toEqual({ hash: 'staged-cache' })
    }
    for (const owned of [staged.owned, windowsOwned]) {
      const hmrProject = path.join(owned, 'hmr', input.id)
      await write(path.join(hmrProject, 'package.json'), '{"name":"hmr-template"}')
      await symlink(path.join(owned, 'input', input.id, 'node_modules'), path.join(hmrProject, 'node_modules'), 'junction')
      expect(await realpath(path.join(hmrProject, 'node_modules/@native-stage/scoped-dependency/package.json'))).toBe(await realpath(path.join(scopedPackage, 'package.json')))
      for (const project of [path.join(owned, 'input', input.id), hmrProject]) {
        const require = createRequire(path.join(project, 'package.json'))
        expect(await realpath(require.resolve(relativePlugin))).toBe(await realpath(originalPlugin))
        expect(require(relativePlugin)).toBe('original-plugin')
      }
    }
    expect(staged.sourceDigest).toBe(sourceDigest)
    expect(staged.manifest).not.toHaveProperty('node_modules')
    await rm(staged.owned, { recursive: true, force: true })
    await rm(windowsOwned, { recursive: true, force: true })
    expect(await Promise.all(links.map(([name]) => readlink(path.join(sourceModules, name))))).toEqual(originalLinks)
    expect(await readFile(path.join(sourceModules, '.modules.yaml'), 'utf8')).toBe('layout: original')
    expect(await readFile(path.join(sourceModules, '.bin/native-stage-test'), 'utf8')).toBe('original-command')
    expect(await readFile(path.join(plugin, 'lib/plugin.cjs'), 'utf8')).toBe('module.exports = "original-plugin"')
    expect(await realpath(path.join(sourceModules, 'weapp-vite/package.json'))).toBe(await realpath(path.join(root, 'packages/weapp-vite/package.json')))
    expect(await realpath(path.join(sourceModules, '@native-stage/scoped-dependency/package.json'))).toBe(await realpath(path.join(scopedPackage, 'package.json')))
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects a missing direct package even when ancestor dependency resolution succeeds', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-stage-direct-')))
  const input = INPUTS[2]
  const source = path.join(root, input.source)
  try {
    await mkdir(path.join(root, 'packages/weapp-vite'), { recursive: true })
    await writeFile(path.join(root, 'packages/weapp-vite/package.json'), '{"name":"weapp-vite"}')
    await mkdir(path.join(root, 'node_modules'))
    await symlink('../packages/weapp-vite', path.join(root, 'node_modules/weapp-vite'), 'dir')
    await mkdir(path.join(source, 'node_modules'), { recursive: true })
    await writeFile(path.join(source, 'package.json'), '{"name":"staged-template"}')
    await writeFile(path.join(source, 'weapp-vite.config.ts'), 'export default {}')
    const sourceDigest = sha256(JSON.stringify(await acceptanceInputManifest(source)))
    const options = parseOptions(['--repo', root, '--output', path.join(root, 'output'), '--native-path', path.join(root, 'native.node')])
    options.inputIdentities = { [input.source]: sourceDigest }
    expect(await realpath(createRequire(path.join(source, 'package.json')).resolve('weapp-vite/package.json'))).toBe(await realpath(path.join(root, 'packages/weapp-vite/package.json')))
    await expect(stageInput(options, input)).rejects.toMatchObject({ code: 'ENOENT' })
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
