import assert from 'node:assert/strict'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 消费安装需在各平台正确解析 npm/pnpm 启动器。
import { execa } from 'execa'
import { readPackedPackageJsonFromTarball } from '../../../scripts/print-rolldown-versions.mjs'
import { inspectConsumerInstallation, profileConsumerStartup, verifyConsumerExports, verifyConsumerNegativeControls } from './consumerEvidence.mjs'
import { createConsumerTemporaryRoot, packConsumerTarballs, readConsumerTarballs, verifyConsumerTarballProvenance } from './consumerTarballs.mjs'
import { resolveConsumerToolchain } from './consumerToolchains.mjs'
import { verifyDependencySemantics } from './verify-dependency-semantics.mjs'
import { verifyPlatformConsumer } from './verify-vite-host-platform.mjs'
import { verifyTailwindConsumer } from './verify-vite-host-tailwind.mjs'

const toolchain = process.argv[2]
assert(['wv', 'vite', 'vite-plus'].includes(toolchain), 'Usage: node verify-vite-host-install.mjs <wv|vite|vite-plus>')
const runtime = process.argv[3]
const runtimeSuite = process.argv[4] ?? 'stateful'
assert(['stateful', 'react', 'independent', 'worker', 'plugin', 'lib', 'platform', 'web'].includes(runtimeSuite))
assert(runtime === undefined || ['headless', 'devtools', 'both'].includes(runtime))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoot = await createConsumerTemporaryRoot()
const consumerRoot = path.join(temporaryRoot, 'consumer')

try {
  await mkdir(consumerRoot)
  const entryPackages = ['weapp-vite', 'wevu', ...(runtimeSuite === 'react' ? ['@weapp-vite/react'] : [])]
  const packedDirectory = process.env.WEAPP_VITE_CONSUMER_TARBALLS
  const dependencies = packedDirectory
    ? await readConsumerTarballs(packedDirectory, entryPackages)
    : await packConsumerTarballs(repoRoot, temporaryRoot, entryPackages)
  const candidates = { ...dependencies }
  // 所有候选已是直接 tarball 依赖；额外覆盖整个闭包会触发 npm 11.6 的 override-set 冲突。
  const toolchainSelection = resolveConsumerToolchain(toolchain, readPackedPackageJsonFromTarball(dependencies['weapp-vite'].slice(5)))
  const { overrides } = toolchainSelection
  Object.assign(dependencies, toolchainSelection.dependencies)
  dependencies.typescript = '6.0.3'
  if (!runtime || runtimeSuite === 'web') {
    dependencies.tailwindcss = '4.3.3'
  }
  if (runtimeSuite === 'plugin') {
    // 消费用例固定公开版本，不依赖维护仓库 node_modules 的安装状态。
    Object.assign(dependencies, { dayjs: '1.11.21', sass: '1.104.1' })
  }
  if (runtimeSuite === 'worker') {
    // file: 依赖供应目录必须属于消费者本身；否则 npm 会创建越出消费者根目录的链接，
    // 既不反映发布包消费语义，也会被安装闭包的越界链接检查拒绝。
    const vendor = path.join(consumerRoot, 'worker-vendor')
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
  const env = { npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false', npm_config_engine_strict: 'true' }
  const installStarted = performance.now()
  await execa('npm', ['install', '--strict-peer-deps'], { cwd: consumerRoot, env, stdio: 'inherit' })
  const installWallMs = performance.now() - installStarted
  await verifyConsumerTarballProvenance(consumerRoot, candidates)
  await execa('npm', ['ls', 'vite', 'rolldown', 'rolldown-require', 'vitest'], { cwd: consumerRoot, env, stdio: 'inherit' })
  const evidence = {
    schemaVersion: 1,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    toolchain,
    installation: { wallMs: installWallMs, ...await inspectConsumerInstallation(consumerRoot) },
    exports: await verifyConsumerExports(consumerRoot, candidates),
    negativeControls: await verifyConsumerNegativeControls(consumerRoot, candidates),
    startup: await profileConsumerStartup(consumerRoot),
  }
  const loadedPackages = new Set(evidence.startup.trace.modules.map(module => module.package))
  for (const adapter of ['@weapp-vite/web', '@weapp-tailwindcss/engine', 'vite-tsconfig-paths', 'tsconfck']) {
    assert(!loadedPackages.has(adapter), `Inactive adapter loaded by CLI help: ${adapter}`)
  }
  if (process.env.WEAPP_VITE_CONSUMER_EVIDENCE) {
    const output = path.resolve(process.env.WEAPP_VITE_CONSUMER_EVIDENCE)
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  console.log(`Published targets and negative controls passed; installed ${evidence.installation.fileBytes} logical bytes; CLI loaded ${evidence.startup.trace.modules.length} modules (instrumented).`)
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
  if (!runtime || runtimeSuite === 'web') {
    await verifyTailwindConsumer(consumerRoot, toolchain)
  }
  if (runtimeSuite === 'web' || process.env.WEAPP_VITE_CONSUMER_WEB === '1') {
    // Windows 会锁住进程已加载的原生库；验证进程退出后，安装目录 owner 才能完整清理。
    await execa(process.execPath, [
      fileURLToPath(new URL('./verify-vite-host-web.mjs', import.meta.url)),
      consumerRoot,
      toolchain,
      repoRoot,
    ], { cwd: repoRoot, stdio: 'inherit' })
  }
  else if (runtime && runtimeSuite === 'platform') {
    await verifyPlatformConsumer(consumerRoot, toolchain, repoRoot, runtime)
  }
  else if (runtime) {
    assert(runtimeSuite !== 'stateful' || toolchain === 'vite-plus', 'stateful 独立 runtime 消费验证当前用于 Vite+；wv/vite 直接运行共享 fixture')
    const fixtureRoot = runtimeSuite === 'plugin' ? path.join(repoRoot, 'templates/weapp-vite-plugin-template') : path.join(repoRoot, 'e2e-apps', runtimeSuite === 'react' ? 'react-runtime-spike' : runtimeSuite === 'independent' ? 'wevu-subpackage-placement' : runtimeSuite === 'worker' ? 'chunk-modes' : runtimeSuite === 'lib' ? 'lib-mode' : 'stateful-hmr')
    await rm(path.join(consumerRoot, 'src'), { recursive: true, force: true })
    for (const entry of ['src', 'project.config.json', 'project.private.config.json', ...runtimeSuite === 'plugin' ? ['plugin', 'shared', 'tsconfig.json'] : runtimeSuite === 'lib' ? ['runtime', 'tsconfig.json'] : []]) {
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
    if (runtimeSuite === 'lib') {
      for (const name of ['weapp-vite.runtime-lib.config.ts', 'weapp-vite.runtime.config.ts']) {
        let config = await readFile(path.join(fixtureRoot, name), 'utf8')
        if (toolchain !== 'wv') {
          config = config.replace('from \'weapp-vite\'', `from '${toolchain}'`).replace('export default defineConfig({', `import { weapp } from 'weapp-vite/vite'\n\nexport default defineConfig({\n  plugins: [weapp()],`)
        }
        await writeFile(path.join(consumerRoot, name), config)
        if (name.includes('runtime-lib')) {
          await writeFile(path.join(consumerRoot, 'vite.config.mts'), config)
        }
      }
      for (const operation of toolchain === 'wv' ? ['dev'] : ['dev', 'build-watch']) {
        await execa(process.execPath, [fileURLToPath(new URL('./verify-vite-host-dev.mjs', import.meta.url)), consumerRoot, toolchain, operation, 'lib'], { cwd: repoRoot, stdio: 'inherit' })
      }
    }
    else if (runtimeSuite !== 'stateful') {
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
        runtimeSuite === 'lib' ? 'e2e/ide/lib-host.runtime.test.ts' : runtimeSuite === 'plugin' ? 'e2e/ide/issue-963-plugin-es6.runtime.test.ts' : runtimeSuite === 'react' ? 'e2e/ide/react-runtime-spike.runtime.test.ts' : runtimeSuite === 'independent' ? 'e2e/ide/wevu-subpackage-placement.runtime.test.ts' : runtimeSuite === 'worker' ? 'e2e/ide/worker-host.runtime.test.ts' : 'e2e/ide/stateful-hmr.runtime.test.ts',
        '-t',
        runtimeSuite === 'lib'
          ? 'renders compiled native and Vue libraries'
          : runtimeSuite === 'plugin'
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
          [runtimeSuite === 'lib' ? 'WEAPP_VITE_E2E_LIB_PROJECT' : runtimeSuite === 'plugin' ? 'WEAPP_VITE_E2E_PLUGIN_PROJECT' : runtimeSuite === 'react' ? 'WEAPP_VITE_E2E_REACT_PROJECT' : runtimeSuite === 'independent' ? 'WEAPP_VITE_E2E_INDEPENDENT_PROJECT' : runtimeSuite === 'worker' ? 'WEAPP_VITE_E2E_WORKER_PROJECT' : 'WEAPP_VITE_E2E_STATEFUL_PROJECT']: consumerRoot,
        },
      })
    }
  }
  if (process.env.WEAPP_VITE_CONSUMER_DEPENDENCIES === '1') {
    console.log(JSON.stringify(await verifyDependencySemantics(consumerRoot), null, 2))
  }
}
finally {
  if (process.env.WEAPP_VITE_CONSUMER_KEEP === '1') {
    console.log(`Retained isolated consumer: ${consumerRoot}`)
  }
  else {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
