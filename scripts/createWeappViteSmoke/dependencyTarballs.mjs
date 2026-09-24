import fs from 'node:fs/promises'
import path from 'node:path'

const ENV_NAME = 'CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS'
const PACKAGE_NAME_RE = /^(?:@[a-z\d][a-z\d._-]*\/)?[a-z\d][a-z\d._-]*$/

/** 只接受明确的本地候选包映射；不把路径或原始 JSON 写进诊断。 */
export async function resolveDependencyTarballs(value) {
  if (value === undefined || value.trim() === '') {
    return []
  }
  let configured
  try {
    configured = JSON.parse(value)
  }
  catch {
    throw new Error(`${ENV_NAME} must be a JSON object mapping package names to absolute .tgz files`)
  }
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    throw new Error(`${ENV_NAME} must be a JSON object`)
  }
  const artifacts = []
  for (const [name, tarball] of Object.entries(configured)) {
    if (!PACKAGE_NAME_RE.test(name) || name.length > 214) {
      throw new Error(`${ENV_NAME} contains an invalid package name`)
    }
    if (typeof tarball !== 'string' || !path.isAbsolute(tarball) || !tarball.endsWith('.tgz')) {
      throw new Error(`${ENV_NAME}: ${name} must reference an absolute .tgz file`)
    }
    const stat = await fs.stat(tarball).catch(() => null)
    if (!stat?.isFile()) {
      throw new Error(`${ENV_NAME}: ${name} must reference an existing .tgz file`)
    }
    artifacts.push({ name, tarball: path.normalize(tarball), filename: path.basename(tarball) })
  }
  return artifacts
}

export function validateDependencyTarballScenarios(artifacts, scenarios) {
  if (artifacts.length && scenarios.some(scenario => scenario.name !== 'pnpm')) {
    throw new Error(`${ENV_NAME} uses pnpm overrides; set CREATE_WEAPP_VITE_SCENARIOS=pnpm`)
  }
}

/** 报告只说明候选包身份，不包含本机目录。 */
export function describeDependencyTarballs(artifacts) {
  return {
    dependencySource: artifacts.length ? 'local-tarballs' : 'registry',
    dependencyArtifacts: artifacts.map(({ name, filename }) => ({ name, filename })),
  }
}

/** 仅改写 smoke 临时项目，用全局 overrides 覆盖直接和传递依赖的固定版本。 */
export async function applyDependencyTarballs(projectDir, artifacts) {
  if (!artifacts.length) {
    return
  }
  // 外部 registry smoke 不安装仓库依赖；只有本地候选验证才需要 YAML 工具。
  const { isMap, parseDocument } = await import('yaml')
  const configPath = path.join(projectDir, 'pnpm-workspace.yaml')
  const source = await fs.readFile(configPath, 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return 'packages: []\n'
  })
  const document = parseDocument(source)
  if (document.errors.length || !isMap(document.contents)) {
    throw new Error('Local dependency candidates require a valid pnpm-workspace.yaml mapping')
  }
  const overrides = document.get('overrides', true)
  if (overrides !== undefined && !isMap(overrides)) {
    throw new Error('Local dependency candidates require pnpm overrides to be a mapping')
  }
  for (const { name, tarball } of artifacts) {
    document.setIn(['overrides', name], `file:${tarball.replaceAll('\\', '/')}`)
  }
  await fs.writeFile(configPath, document.toString())
}
