import type { PackageJson } from 'pkg-types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
// eslint-disable-next-line e18e/ban-dependencies -- 复用脚手架现有 semver，保持 pnpm peer 范围的 caret、并集和预发布语义。
import { satisfies } from 'semver'
import { parseDocument } from 'yaml'
import { TEMPLATE_CATALOG } from './generated/catalog'
import { findPnpmWorkspaceRoot } from './pnpmBuildPolicy'

export type Toolchain = 'wv' | 'vite' | 'vite-plus'

const VITE_PLUS_VERSION = '1.0.0'
const VITE_PLUS_VITEST_VERSION = '5.0.1'
const VITE_PLUS_CORE = `npm:@voidzero-dev/vite-plus-core@${VITE_PLUS_VERSION}`

/** 工具链与业务模板正交，非法选择必须在复制模板前失败。 */
export function validateToolchain(value: unknown): asserts value is Toolchain {
  if (value !== 'wv' && value !== 'vite' && value !== 'vite-plus') {
    throw new Error(`无效的工具链：${String(value)}，仅支持 wv、vite 或 vite-plus`)
  }
}

/** 不修改上级工作区；Vite+ 成员必须复用该工作区已配置的同版本引擎。 */
export async function validateToolchainWorkspace(root: string, toolchain: Toolchain) {
  if (toolchain !== 'vite-plus') {
    return
  }
  const workspace = await findPnpmWorkspaceRoot(root)
  if (!workspace || path.resolve(workspace) === path.resolve(root)) {
    return
  }
  const document = parseDocument(await fs.readFile(path.join(workspace, 'pnpm-workspace.yaml'), 'utf8'))
  if (document.getIn(['overrides', 'vite']) !== VITE_PLUS_CORE) {
    throw new Error(`Vite+ 项目所属工作区须先配置 overrides.vite: ${VITE_PLUS_CORE}，以保证所有成员使用同一 Vite 引擎。`)
  }
  if (document.getIn(['overrides', 'vitest']) !== VITE_PLUS_VITEST_VERSION) {
    throw new Error(`Vite+ 项目所属工作区须先配置 overrides.vitest: ${VITE_PLUS_VITEST_VERSION}，以保证测试包与 vp test 使用同一 runner。`)
  }
  const vitePeers = document.getIn(['peerDependencyRules', 'allowedVersions', 'vite'])
  if (typeof vitePeers !== 'string' || !satisfies(VITE_PLUS_VERSION, vitePeers)) {
    throw new Error(`Vite+ 项目所属工作区须先配置 peerDependencyRules.allowedVersions.vite: ${VITE_PLUS_VERSION}，以声明 core alias 的工具链版本兼容并保留严格 peer 检查。`)
  }
}

function renderConfig(toolchain: Toolchain, source: string, platform?: string) {
  const host = toolchain === 'vite-plus' ? 'vite-plus' : 'vite'
  const platformLine = platform ? `\n      platform: '${platform}',` : ''
  const webEnabled = platform ? String(platform === 'web') : 'config.weapp?.platform === \'web\''
  return `import { defineConfig } from '${host}'
import { weapp } from 'weapp-vite/vite'
import base from './${source.replace(/\.ts$/, '')}'

export default defineConfig(async (env) => {
  const config = await (typeof base === 'function' ? base(env) : base)
  return {
    ...config,
    weapp: {
      ...config.weapp,${platformLine}
      web: { ...config.weapp?.web, enable: ${webEnabled} },
    },
    plugins: [weapp(), ...(config.plugins ?? [])],
  }
})
`
}

/** 从共享业务模板派生宿主入口，仅改写普通 build/dev，保留小程序专属命令。 */
export async function applyToolchain(root: string, pkg: PackageJson, toolchain: Toolchain) {
  if (toolchain === 'wv') {
    return
  }
  const source = 'weapp-vite.config.ts'
  if (!await fs.pathExists(path.join(root, source))) {
    await fs.move(path.join(root, 'vite.config.ts'), path.join(root, source))
  }
  const configurations = new Map<string, { source: string, platform?: string }>([
    ['vite.config.ts', { source }],
  ])
  const command = toolchain === 'vite-plus' ? 'vp' : 'vite'
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    if (typeof script !== 'string') {
      continue
    }
    const match = /^wv (dev|build)(?: -p (weapp|alipay|tt|swan|jd|xhs|web))?(?: --config (weapp-vite(?:\.[\w-]+)?\.config\.ts))?( --host)?$/.exec(script)
    if (!match) {
      continue
    }
    const [, action, platform, explicitSource, hostFlag = ''] = match
    const configFile = explicitSource
      ? explicitSource.replace(/^weapp-vite/, 'vite')
      : platform ? `vite.${platform}.config.ts` : 'vite.config.ts'
    configurations.set(configFile, { source: explicitSource ?? source, platform })
    pkg.scripts![name] = `${command} ${action}${configFile === 'vite.config.ts' ? '' : ` --config ${configFile}`}${hostFlag}`
  }
  for (const [fileName, config] of configurations) {
    await fs.writeFile(path.join(root, fileName), renderConfig(toolchain, config.source, config.platform))
  }
  pkg.devDependencies ??= {}
  pkg.engines = { ...pkg.engines, node: '^22.22.2 || ^24.15.0 || >=26.0.0' }
  if (toolchain === 'vite') {
    pkg.devDependencies.vite = TEMPLATE_CATALOG.vite
    return
  }
  pkg.devDependencies['vite-plus'] = VITE_PLUS_VERSION
  pkg.devDependencies.vite = VITE_PLUS_CORE
  pkg.overrides = { ...pkg.overrides, vite: VITE_PLUS_CORE, vitest: VITE_PLUS_VITEST_VERSION }
  pkg.engines.node = '^24.15.0 || >=26.0.0'
  const workspace = await findPnpmWorkspaceRoot(root)
  if (workspace && path.resolve(workspace) === path.resolve(root)) {
    const fileName = path.join(workspace, 'pnpm-workspace.yaml')
    const document = parseDocument(await fs.readFile(fileName, 'utf8'))
    document.setIn(['overrides', 'vite'], VITE_PLUS_CORE)
    document.setIn(['overrides', 'vitest'], VITE_PLUS_VITEST_VERSION)
    // core 使用工具链版本号，声明精确 alias 版本兼容，其他依赖仍保持严格 peer 检查。
    document.setIn(['peerDependencyRules', 'allowedVersions', 'vite'], VITE_PLUS_VERSION)
    await fs.writeFile(fileName, document.toString())
  }
}
