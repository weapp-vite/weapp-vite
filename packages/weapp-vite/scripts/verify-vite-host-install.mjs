import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 消费安装需在各平台正确解析 npm/pnpm 启动器。
import { execa } from 'execa'

const toolchain = process.argv[2]
assert(['wv', 'vite', 'vite-plus'].includes(toolchain), 'Usage: node verify-vite-host-install.mjs <wv|vite|vite-plus>')
const runtime = process.argv[3]
const runtimeSuite = process.argv[4] ?? 'stateful'
assert(['stateful', 'react', 'independent', 'worker', 'plugin'].includes(runtimeSuite))
assert(runtime === undefined || ['headless', 'devtools', 'both'].includes(runtime))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-host-install-'))
const consumerRoot = path.join(temporaryRoot, 'consumer')

try {
  await mkdir(consumerRoot)
  const dependencies = {}
  const overrides = {}
  const listing = await execa('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { cwd: repoRoot })
  const projects = new Map(JSON.parse(listing.stdout).map(project => [project.name, project.path]))
  const pending = ['weapp-vite', 'wevu', ...(runtimeSuite === 'react' ? ['@weapp-vite/react'] : [])]
  const packed = new Set()
  // 遍历完整运行时 workspace 依赖闭包；混用旧发布常量或 runtime 会掩盖/制造兼容问题。
  while (pending.length) {
    const name = pending.pop()
    if (packed.has(name)) {
      continue
    }
    const projectRoot = projects.get(name)
    assert(projectRoot, `Missing workspace dependency: ${name}`)
    const manifest = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
    assert.notEqual(manifest.private, true, `Cannot publish private runtime dependency: ${name}`)
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, specifier] of Object.entries(manifest[section] ?? {})) {
        if (specifier.startsWith('workspace:')) {
          pending.push(dependency)
        }
      }
    }
    const tarball = path.join(temporaryRoot, `${name.replaceAll('/', '-')}.tgz`)
    await execa('pnpm', ['--filter', name, 'pack', '--out', tarball], { cwd: repoRoot })
    dependencies[name] = `file:${tarball.replaceAll('\\', '/')}`
    overrides[name] = dependencies[name]
    packed.add(name)
  }
  if (toolchain !== 'wv') {
    Object.assign(dependencies, { vite: '8.3.1', vitest: '5.0.2', typescript: '5.9.3' })
  }
  if (toolchain === 'vite-plus') {
    Object.assign(dependencies, {
      'vite': 'npm:@voidzero-dev/vite-plus-core@1.0.0',
      'vite-plus': '1.0.0',
      'vitest': '5.0.1',
    })
    overrides.vite = 'npm:@voidzero-dev/vite-plus-core@1.0.0'
  }
  if (runtimeSuite === 'plugin') {
    // 消费用例固定公开版本，不依赖维护仓库 node_modules 的安装状态。
    Object.assign(dependencies, { dayjs: '1.11.21', sass: '1.104.1' })
  }
  if (runtimeSuite === 'worker') {
    const vendor = path.join(temporaryRoot, 'worker-vendor')
    await cp(path.join(repoRoot, 'e2e-apps/chunk-modes/node_modules/fake-pkg'), vendor, { recursive: true })
    dependencies['fake-pkg'] = `file:${vendor.replaceAll('\\', '/')}`
  }
  await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify({
    name: `weapp-vite-host-${toolchain}`,
    private: true,
    type: 'module',
    dependencies,
    overrides,
  }, null, 2)}\n`)
  // 不继承用户或工作区中的 peer 绕过开关，安装失败必须真实阻断验收。
  const env = { npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false' }
  await execa('npm', ['install', '--strict-peer-deps'], { cwd: consumerRoot, env, stdio: 'inherit' })
  await execa('npm', ['ls', 'vite', 'rolldown', 'rolldown-require', 'vitest'], { cwd: consumerRoot, env, stdio: 'inherit' })
  const installed = JSON.parse(await readFile(path.join(consumerRoot, 'package.json'), 'utf8'))
  if (toolchain === 'wv') {
    assert.equal(installed.dependencies.vite, undefined)
    assert.equal(installed.dependencies['vite-plus'], undefined)
  }
  await execa(process.execPath, [
    fileURLToPath(new URL('./verify-vite-host-consumer.mjs', import.meta.url)),
    consumerRoot,
    ...(toolchain === 'wv' ? ['wv'] : []),
  ], { cwd: repoRoot, stdio: 'inherit' })
  if (runtime) {
    assert(runtimeSuite !== 'stateful' || toolchain === 'vite-plus', 'stateful 独立 runtime 消费验证当前用于 Vite+；wv/vite 直接运行共享 fixture')
    const fixtureRoot = runtimeSuite === 'plugin' ? path.join(repoRoot, 'templates/weapp-vite-plugin-template') : path.join(repoRoot, 'e2e-apps', runtimeSuite === 'react' ? 'react-runtime-spike' : runtimeSuite === 'independent' ? 'wevu-subpackage-placement' : runtimeSuite === 'worker' ? 'chunk-modes' : 'stateful-hmr')
    await rm(path.join(consumerRoot, 'src'), { recursive: true, force: true })
    for (const entry of ['src', 'project.config.json', 'project.private.config.json', ...runtimeSuite === 'plugin' ? ['plugin', 'shared', 'tsconfig.json'] : []]) {
      await cp(path.join(fixtureRoot, entry), path.join(consumerRoot, entry), { recursive: true })
    }
    if (runtimeSuite === 'stateful') {
      await cp(path.join(fixtureRoot, 'public'), path.join(consumerRoot, 'public'), { recursive: true })
    }
    if (runtimeSuite === 'plugin') {
      for (const name of ['project.config.json', 'project.private.config.json']) {
        const file = path.join(consumerRoot, name)
        const project = JSON.parse(await readFile(file, 'utf8'))
        project.libVersion = '3.17.3'
        project.setting = { ...project.setting, es6: false, packNpmManually: false }
        delete project.setting.packNpmRelationList
        await writeFile(file, `${JSON.stringify(project, null, 2)}\n`)
      }
    }
    if (runtimeSuite !== 'stateful') {
      const config = `import { appendFileSync } from 'node:fs'
import { defineConfig } from '${toolchain === 'wv' ? 'weapp-vite' : toolchain}'
${toolchain === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default defineConfig({
  ${toolchain === 'wv' ? '' : 'plugins: [weapp()],'}
  build: { minify: true },
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), __WEAPP_CHUNK_SCENARIO__: JSON.stringify('worker') },
  weapp: { srcRoot: 'src', ${runtimeSuite === 'plugin' ? 'pluginRoot: \'plugin\', typescript: { app: { include: [\'../shared/**/*\'], compilerOptions: { paths: { \'@/*\': [\'./*\'] } } } }, npm: { enable: true, pluginPackage: { dependencies: [\'dayjs\'] } },' : runtimeSuite === 'react' ? 'react: { compiler: false, renderMode: \'auto\' },' : runtimeSuite === 'worker' ? 'worker: { entry: [\'index\', \'messages/index\'] },' : ''} hmr: { runtime: 'classic' } },
})
`
      await writeFile(path.join(consumerRoot, `vite.${runtimeSuite}.config.mts`), config)
      await writeFile(path.join(consumerRoot, 'vite.config.mts'), config)
      for (const operation of toolchain === 'wv' ? ['dev', 'stateful-dev'] : ['dev', 'build-watch', 'stateful-dev']) {
        await execa(process.execPath, [
          fileURLToPath(new URL('./verify-vite-host-dev.mjs', import.meta.url)),
          consumerRoot,
          toolchain,
          operation,
          runtimeSuite,
        ], { cwd: repoRoot, stdio: 'inherit' })
      }
    }
    else {
      await writeFile(path.join(consumerRoot, 'vite.stateful.config.mts'), `import { defineConfig } from 'vite-plus'
import { weapp } from 'weapp-vite/vite'
export default defineConfig({
  plugins: [weapp()],
  weapp: { srcRoot: 'src', appPrelude: { webRuntime: true }, hmr: { runtime: 'stateful-experimental', logLevel: 'verbose' } },
})
`)
    }
    for (const provider of runtime === 'both' ? ['headless', 'devtools'] : [runtime]) {
      await execa('pnpm', [
        'vitest',
        'run',
        '-c',
        'e2e/vitest.e2e.devtools.config.ts',
        runtimeSuite === 'plugin' ? 'e2e/ide/issue-963-plugin-es6.runtime.test.ts' : runtimeSuite === 'react' ? 'e2e/ide/react-runtime-spike.runtime.test.ts' : runtimeSuite === 'independent' ? 'e2e/ide/wevu-subpackage-placement.runtime.test.ts' : runtimeSuite === 'worker' ? 'e2e/ide/worker-host.runtime.test.ts' : 'e2e/ide/stateful-hmr.runtime.test.ts',
        '-t',
        runtimeSuite === 'plugin'
          ? 'ES6: disabled'
          : runtimeSuite === 'react'
            ? 'renders React hooks|renders the compiled native WXML|all six interop edges'
            : runtimeSuite === 'worker'
              ? 'exchanges worker messages'
              : runtimeSuite === 'independent'
                ? 'visits main, normal subpackage, and independent subpackage vue routes'
                : provider === 'devtools'
                  ? 'preserves native Page|preserves native Component|preserves Wevu local and store|preserves native page state across two template'
                  : 'preserves native Component|preserves Wevu local and store|preserves native page state across two template',
      ], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: {
          WEAPP_VITE_E2E_RUNTIME_PROVIDER: provider,
          WEAPP_VITE_E2E_COMPILER_HOST: toolchain,
          [runtimeSuite === 'plugin' ? 'WEAPP_VITE_E2E_PLUGIN_PROJECT' : runtimeSuite === 'react' ? 'WEAPP_VITE_E2E_REACT_PROJECT' : runtimeSuite === 'independent' ? 'WEAPP_VITE_E2E_INDEPENDENT_PROJECT' : runtimeSuite === 'worker' ? 'WEAPP_VITE_E2E_WORKER_PROJECT' : 'WEAPP_VITE_E2E_STATEFUL_PROJECT']: consumerRoot,
        },
      })
    }
  }
}
finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
