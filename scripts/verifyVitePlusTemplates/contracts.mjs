import assert from 'node:assert/strict'
import { createPnpmCommand } from '../createWeappViteSmoke/commands.mjs'
import { createPnpmProfileConfig, createRegistryEnvironment } from '../createWeappViteSmoke/registry.mjs'

export const templateNames = ['default', 'wevu', 'tailwindcss', 'tdesign', 'wevu-tdesign', 'vant', 'react']
export const requiredCandidates = ['@weapp-vite/language-service', '@weapp-vite/oxlint', '@weapp-vite/oxfmt', '@weapp-vite/eslint']

/** 固定完整验收矩阵；显式筛选仍在报告中保留完整计划和未运行项目。 */
export function selectCases(value) {
  const matrix = [
    ...templateNames.map(template => ({ id: `pnpm/${template}`, manager: 'pnpm', template, workspace: false })),
    { id: 'npm/default', manager: 'npm', template: 'default', workspace: false },
    { id: 'pnpm/platforms', manager: 'pnpm', template: 'multi-platform', workspace: false, platforms: ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs'] },
    { id: 'pnpm/workspace', manager: 'pnpm', template: 'default', workspace: true },
  ]
  if (value === undefined) {
    return { matrix, selected: matrix }
  }
  const ids = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
  assert(ids.length, 'VITE_PLUS_TEMPLATE_CASES cannot be empty')
  assert(ids.every(id => matrix.some(item => item.id === id)), 'Unknown VITE_PLUS_TEMPLATE_CASES entry')
  return { matrix, selected: matrix.filter(item => ids.includes(item.id)) }
}

/** 每个阶段显式执行，缺少脚本即失败，不能使用 --if-present 隐藏漏测。 */
export function qualityScripts(manifest) {
  const scripts = ['lint', 'format:check', 'check', ...(manifest.scripts?.['lint:vue'] ? ['lint:vue'] : []), 'stylelint', 'build']
  for (const script of scripts) {
    assert(typeof manifest.scripts?.[script] === 'string', `Missing generated script: ${script}`)
  }
  return scripts
}

export function strictEnvironment(registry, cacheRoot, baseEnv) {
  const env = createRegistryEnvironment({ registry }, cacheRoot, baseEnv)
  delete env.NODE_OPTIONS
  delete env.NODE_PATH
  for (const [name, value] of Object.entries({ strict_peer_deps: 'true', legacy_peer_deps: 'false', force: 'false', engine_strict: 'true', ignore_scripts: 'false' })) {
    env[`npm_config_${name}`] = value
    env[`NPM_CONFIG_${name.toUpperCase()}`] = value
  }
  return env
}

export function managerCommand(manager, args, registry, cacheRoot) {
  if (manager === 'npm') {
    return { command: 'npm', args }
  }
  assert.equal(manager, 'pnpm')
  return createPnpmCommand(args, undefined, {
    ...createPnpmProfileConfig({ registry }, cacheRoot),
    'strict-peer-dependencies': true,
    'engine-strict': true,
    'link-workspace-packages': false,
    'prefer-workspace-packages': false,
    'verify-deps-before-run': false,
  })
}
