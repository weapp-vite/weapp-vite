import assert from 'node:assert/strict'
// eslint-disable-next-line e18e/ban-dependencies -- 发布包引擎规格复用已有依赖，保持与 npm 一致的 semver 范围语义。
import { valid, validRange } from 'semver'
import vitePlusVersions from '../../create-weapp-vite/src/vitePlusVersions.json' with { type: 'json' }

// Vite 使用候选发布包声明的引擎；Vite+ 的 launcher/core 必须使用同一批准版本。
export const consumerToolchainVersions = {
  'vite': { vitest: '5.0.2' },
  'vite-plus': vitePlusVersions,
}

/** 从实际发布清单和显式配对配置生成消费依赖，避免宿主与编译器的版本来源漂移。 */
export function resolveConsumerToolchain(toolchain, candidateManifest, versions = consumerToolchainVersions) {
  assert(['wv', 'vite', 'vite-plus'].includes(toolchain), `Unknown consumer toolchain: ${toolchain}`)
  if (toolchain === 'wv') {
    return { dependencies: {}, overrides: {} }
  }
  assert.equal(candidateManifest.name, 'weapp-vite', 'Expected the packed weapp-vite manifest')
  const compilerVite = candidateManifest.dependencies?.vite
  assert(typeof compilerVite === 'string' && compilerVite.trim() && validRange(compilerVite), 'Packed weapp-vite must declare a published Vite version range')
  const pairing = versions[toolchain]
  assert(typeof pairing?.vitest === 'string' && valid(pairing.vitest), 'Consumer Vitest must use an exact paired version')
  if (toolchain === 'vite') {
    return { dependencies: { vite: compilerVite, vitest: pairing.vitest }, overrides: {} }
  }
  assert(typeof pairing.version === 'string' && valid(pairing.version), 'Vite+ launcher and core must use one exact paired version')
  const vite = `npm:@voidzero-dev/vite-plus-core@${pairing.version}`
  return {
    dependencies: { vite, 'vite-plus': pairing.version, 'vitest': pairing.vitest },
    overrides: { vite },
  }
}
