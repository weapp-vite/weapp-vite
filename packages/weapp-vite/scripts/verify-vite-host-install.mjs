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
assert(runtime === undefined || ['headless', 'devtools'].includes(runtime))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-host-install-'))
const consumerRoot = path.join(temporaryRoot, 'consumer')

try {
  await mkdir(consumerRoot)
  const dependencies = {}
  const overrides = {}
  const listing = await execa('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], { cwd: repoRoot })
  const projects = new Map(JSON.parse(listing.stdout).map(project => [project.name, project.path]))
  const pending = ['weapp-vite', 'wevu']
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
    assert.equal(toolchain, 'vite-plus', '独立 runtime 消费验证当前用于 Vite+；wv/vite 直接运行共享 fixture')
    const fixtureRoot = path.join(repoRoot, 'e2e-apps/stateful-hmr')
    await rm(path.join(consumerRoot, 'src'), { recursive: true, force: true })
    for (const entry of ['src', 'public', 'project.config.json', 'project.private.config.json']) {
      await cp(path.join(fixtureRoot, entry), path.join(consumerRoot, entry), { recursive: true })
    }
    await writeFile(path.join(consumerRoot, 'vite.stateful.config.mts'), `import { defineConfig } from 'vite-plus'
import { weapp } from 'weapp-vite/vite'
export default defineConfig({
  plugins: [weapp()],
  weapp: { srcRoot: 'src', appPrelude: { webRuntime: true }, hmr: { runtime: 'stateful-experimental', logLevel: 'verbose' } },
})
`)
    await execa('pnpm', [
      'vitest',
      'run',
      '-c',
      'e2e/vitest.e2e.devtools.config.ts',
      'e2e/ide/stateful-hmr.runtime.test.ts',
      '-t',
      runtime === 'devtools'
        ? 'preserves native Page|preserves native Component|preserves Wevu local and store|preserves native page state across two template'
        : 'preserves native Component|preserves Wevu local and store|preserves native page state across two template',
    ], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        WEAPP_VITE_E2E_RUNTIME_PROVIDER: runtime,
        WEAPP_VITE_E2E_COMPILER_HOST: toolchain,
        WEAPP_VITE_E2E_STATEFUL_PROJECT: consumerRoot,
      },
    })
  }
}
finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
