import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

/** 固定分离 peer 图的消费者策略；候选清单来自既有 tarball 闭包。 */
export function createDashboardIsolationWorkspace(candidates, consumerRoot) {
  return {
    packages: [],
    nodeLinker: 'isolated',
    hoist: false,
    shamefullyHoist: false,
    linkWorkspacePackages: false,
    enableGlobalVirtualStore: false,
    // pnpm 12 任一开关开启都会补入当前安装图可提供的 optional peer。
    autoInstallPeers: false,
    dedupePeerDependents: false,
    strictPeerDependencies: true,
    storeDir: path.join(consumerRoot, '.pnpm-store'),
    overrides: { ...candidates },
    // Parcel 使用平台预编译绑定，沿用仓库对源码安装脚本的显式拒绝。
    allowBuilds: { '@parcel/watcher': false, '@swc/core': true, 'esbuild': true },
  }
}

/** 两个开关必须同时关闭，严格安装与不提升依赖仍不能单独证明 peer 隔离。 */
export function assertDashboardIsolationWorkspace(workspace) {
  assert.equal(workspace.autoInstallPeers, false, 'Dashboard isolation must disable automatic peer installation')
  assert.equal(workspace.dedupePeerDependents, false, 'Dashboard isolation must disable peer-dependent deduplication')
  assert.equal(workspace.strictPeerDependencies, true, 'Dashboard isolation must retain strict peer validation')
}

/** 核验消费者真实安装路径与传输的 peer 身份；不加载工作区或执行模块。 */
export function assertDashboardConsumerPeerGraph(consumerRoot) {
  const root = realpathSync(consumerRoot)
  const modules = realpathSync(path.join(consumerRoot, 'node_modules'))
  const modulesRelative = path.relative(root, modules)
  assert(modulesRelative && modulesRelative !== '..' && !modulesRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(modulesRelative), 'Consumer node_modules escaped the physical installation root')
  const resolve = (manifest, specifier) => {
    const file = realpathSync(createRequire(manifest).resolve(specifier))
    const relative = path.relative(modules, file)
    assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Installed module escaped consumer node_modules: ${specifier}`)
    return file
  }
  const manifest = path.join(consumerRoot, 'package.json')
  const coreManifest = resolve(manifest, 'weapp-vite/package.json')
  const ownerManifest = resolve(manifest, '@weapp-vite/dashboard/package.json')
  const coreDevframe = resolve(coreManifest, 'devframe/package.json')
  const ownerDevframe = resolve(ownerManifest, 'devframe/package.json')
  const ownerAuth = resolve(ownerManifest, 'devframe/node/auth')
  const transportManifests = ['@devframes/agentic', '@devframes/hub', '@devframes/hub-ui']
    .map(name => resolve(ownerManifest, `${name}/package.json`))
  for (const transport of transportManifests) {
    assert.equal(resolve(transport, 'devframe/package.json'), ownerDevframe, 'Transitive peer devframe does not share the selected Dashboard owner')
    assert.equal(resolve(transport, 'devframe/node/auth'), ownerAuth, 'Transitive auth module does not share the selected owner')
  }
  assert.notEqual(coreDevframe, ownerDevframe, 'Strict pnpm case failed to exercise separated optional-peer graphs')
  let resolvesAgentic = false
  try {
    createRequire(coreDevframe).resolve('@devframes/agentic/package.json')
    resolvesAgentic = true
  }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
  }
  assert(!resolvesAgentic, 'Core devframe acquired the optional agentic peer in the isolation case')
  return { coreManifest, ownerManifest, coreDevframe, ownerDevframe, ownerAuth, transportManifests }
}
