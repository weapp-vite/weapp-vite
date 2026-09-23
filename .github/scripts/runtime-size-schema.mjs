const LEGACY_TARGETS = [
  { id: 'weapp', label: '微信小程序', gzip: false },
  { id: 'web', label: 'Web', gzip: true },
]

const TARGETS = [
  LEGACY_TARGETS[0],
  { id: 'alipay', label: '支付宝小程序', gzip: false },
  { id: 'tt', label: '抖音小程序', gzip: false },
  { id: 'swan', label: '百度小程序', gzip: false },
  { id: 'jd', label: '京东小程序', gzip: false },
  { id: 'xhs', label: '小红书小程序', gzip: false },
  LEGACY_TARGETS[1],
]

const LEGACY_TIERS = [
  { id: 'reactivity-core', label: '响应式核心', description: '`ref`' },
  { id: 'minimal-app', label: '最小应用', description: '响应式核心 + `createApp`、`setWevuDefaults`' },
  { id: 'typical-page', label: '典型页面', description: '最小应用 + 组件注册、常用响应式、页面生命周期、class/style 模板辅助' },
  { id: 'complex-component', label: '复杂组件', description: '典型页面 + provide/inject、slots、template ref、model、动态 layout' },
  { id: 'full-provider', label: '完整 Provider', description: '端侧 runtime provider 暴露的全部能力上限' },
]

const TIERS = [
  ...LEGACY_TIERS.slice(0, -1),
  { id: 'public-app', label: '公共入口最小应用', description: '从 `wevu` 具名导入最小应用能力，不使用 router 或请求 API；保留动态工厂兼容能力' },
  { id: 'public-page', label: '公共入口典型页面', description: '从 `wevu` 具名导入典型页面能力，不使用 router 或请求 API；保留动态工厂兼容能力' },
  LEGACY_TIERS.at(-1),
]

export function runtimeSizeSchema(version) {
  if (![2, 3, 4].includes(version)) {
    throw new Error('Unsupported runtime size artifact.')
  }
  return version === 4 ? { targets: TARGETS, tiers: TIERS } : { targets: LEGACY_TARGETS, tiers: LEGACY_TIERS }
}

export function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value
}

function assertCommit(value, label) {
  const commit = assertString(value, label)
  if (!/^[\da-f]{7,64}$/i.test(commit)) {
    throw new Error(`${label} must be a hexadecimal Git commit.`)
  }
}

function assertBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`)
  }
}

function validateRetainedModules(value, label) {
  const retained = assertObject(value, label)
  assertString(retained.entry, `${label}.entry`)
  if (!Array.isArray(retained.modules)) {
    throw new TypeError(`${label}.modules must be an array.`)
  }
  const paths = new Set()
  for (const module of retained.modules) {
    assertObject(module, `${label}.module`)
    assertString(module.path, `${label}.module.path`)
    assertBytes(module.bytesInOutput, `${label}.module.bytesInOutput`)
    if (paths.has(module.path) || !Array.isArray(module.imports) || module.imports.some(value => typeof value !== 'string')) {
      throw new Error(`${label}.modules must contain unique paths and string imports.`)
    }
    paths.add(module.path)
  }
  if (!paths.has(retained.entry)) {
    throw new Error(`${label}.modules must contain its entry.`)
  }
}

export function validateReport(value, label, version) {
  const { targets, tiers } = runtimeSizeSchema(version)
  const report = assertObject(value, label)
  if (report.version !== version) {
    throw new Error(`${label}.version must match artifact.version (${version}).`)
  }
  assertCommit(report.commit, `${label}.commit`)
  if (!Array.isArray(report.targets) || report.targets.length !== targets.length) {
    throw new Error(`${label}.targets must contain the configured runtime targets.`)
  }
  for (const [index, expected] of targets.entries()) {
    const target = report.targets[index]
    if (target?.id !== expected.id) {
      throw new Error(`${label}.targets[${index}] must be ${expected.id}.`)
    }
    if (!Array.isArray(target.tiers) || target.tiers.length !== tiers.length) {
      throw new Error(`${label}.${expected.id}.tiers must contain the configured runtime tiers.`)
    }
    for (const [tierIndex, expectedTier] of tiers.entries()) {
      const tier = target.tiers[tierIndex]
      const scope = `${label}.${expected.id}.${expectedTier.id}`
      if (tier?.id !== expectedTier.id) {
        throw new Error(`${label}.${expected.id}.tiers[${tierIndex}] must be ${expectedTier.id}.`)
      }
      assertBytes(tier.dev?.bytes, `${scope}.dev.bytes`)
      assertBytes(tier.production?.bytes, `${scope}.production.bytes`)
      if (tier.dev?.gzipBytes !== undefined || (!expected.gzip && tier.production?.gzipBytes !== undefined)) {
        throw new Error(`${scope} must not contain gzipBytes.`)
      }
      if (expected.gzip) {
        assertBytes(tier.production?.gzipBytes, `${scope}.production.gzipBytes`)
      }
      if (version === 4) {
        validateRetainedModules(tier.production?.retainedModules, `${scope}.production.retainedModules`)
      }
    }
  }
  return report
}

export function validateArtifact(value, expected = {}) {
  const artifact = assertObject(value, 'artifact')
  runtimeSizeSchema(artifact.version)
  if (artifact.kind !== 'wevu-runtime-size-pr-report') {
    throw new Error('Unsupported runtime size artifact.')
  }
  for (const [key, label] of [['repository', 'repository'], ['prNumber', 'PR number'], ['headSha', 'head SHA'], ['baseSha', 'base SHA']]) {
    if (expected[key] !== undefined && artifact[key] !== expected[key]) {
      throw new Error(`Artifact ${label} does not match the workflow ${label}.`)
    }
  }
  assertCommit(artifact.headSha, 'artifact.headSha')
  assertCommit(artifact.baseSha, 'artifact.baseSha')
  return {
    ...artifact,
    current: validateReport(artifact.current, 'artifact.current', artifact.version),
    baseline: validateReport(artifact.baseline, 'artifact.baseline', artifact.version),
  }
}
