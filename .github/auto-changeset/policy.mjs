import { createHash } from 'node:crypto'
import path from 'node:path'
import { parse } from 'yaml'
import { isReleaseWorthyWorkspaceFile } from '../../scripts/check-publishable-workspace-changeset.ts'

export const marker = '<!-- repoctl-auto-changeset -->'
const summaryPattern = /^(?:feat|fix|perf|chore|docs|refactor|test|build|ci|style|revert)(?:\([^\s()]+\))?!?:\s+\S/u
const namePattern = /^(?:@[a-z\d][a-z\d._-]*\/)?[a-z\d][a-z\d._-]*$/u
const hash = content => createHash('sha256').update(content).digest('hex')

export function changesetPath(number) {
  return `.changeset/auto-pr-${number}.md`
}

export function hasManualChangeset(files, number) {
  return files.some(file => file.status !== 'removed'
    && /^\.changeset\/[^/]+\.md$/u.test(file.filename)
    && !['.changeset/README.md', changesetPath(number)].includes(file.filename))
}

/** 依赖上游的 major 版本不会自动变成本包的 major；破坏性标题必须明确选择。 */
export function releaseLevel(title, labels = []) {
  const selected = labels.map(label => typeof label === 'string' ? label : label.name)
    .filter(label => /^release:(?:patch|minor|major)$/u.test(label))
  if (selected.length > 1) {
    throw new Error('只能选择一个 release:patch / release:minor / release:major 标签。')
  }
  if (selected.length) {
    return selected[0].slice('release:'.length)
  }
  if (/^[^:]+!:/u.test(title)) {
    throw new Error('破坏性变化需要手写 changeset 或显式 release 级别标签。')
  }
  return /^feat(?:\(|:)/u.test(title) ? 'minor' : 'patch'
}

export function renderChangeset({ packages, level, number, title }) {
  const summary = title.replace(/\s+/gu, ' ').trim()
  if (!summaryPattern.test(summary) || !/\p{Script=Han}/u.test(summary)) {
    throw new Error('请将 PR 标题改为 Conventional 格式的中文摘要，或手动添加 changeset。')
  }
  const lines = [...new Set(packages)].sort().map(name => `${JSON.stringify(name)}: ${level}`)
  const content = `---\n${lines.join('\n')}\n---\n\n${summary} (#${number})\n`
  return `${content}\n<!-- repoctl-auto-changeset sha256:${hash(content)} -->\n`
}

/** 人工修改自动记录后停止接管，保留维护者选择的版本和迁移说明。 */
export function isUnmodifiedGenerated(content) {
  const match = content.match(/\n<!-- repoctl-auto-changeset sha256:([a-f\d]{64}) -->\n$/u)
  return Boolean(match && hash(content.slice(0, match.index)) === match[1])
}

export function workspaceManifestPaths(files, workspaceText) {
  const workspace = parse(workspaceText, { maxAliasCount: 20 })
  if (!Array.isArray(workspace?.packages) || workspace.packages.some(value => typeof value !== 'string')) {
    throw new Error('Invalid pnpm workspace package patterns')
  }
  const includes = workspace.packages.filter(pattern => !pattern.startsWith('!'))
  const excludes = workspace.packages.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1))
  return files.filter(file => file.endsWith('/package.json')).filter((file) => {
    const dir = path.posix.dirname(file)
    return includes.some(pattern => path.matchesGlob(dir, pattern)) && !excludes.some(pattern => path.matchesGlob(dir, pattern))
  })
}

/** 仅解析冻结 PR 的清单数据，绝不导入或执行候选代码。 */
export async function readWorkspaces(client, ref) {
  const [files, workspaceText] = await Promise.all([client.getTree(ref), client.getContent('pnpm-workspace.yaml', ref)])
  const paths = workspaceManifestPaths(files, workspaceText)
  const packages = []
  for (let offset = 0; offset < paths.length; offset += 8) {
    const batch = await Promise.all(paths.slice(offset, offset + 8).map(async (file) => {
      const manifest = JSON.parse(await client.getContent(file, ref))
      if (manifest?.private === true) {
        return undefined
      }
      if (!namePattern.test(manifest?.name ?? '')) {
        throw new Error(`Invalid publishable workspace manifest: ${file}`)
      }
      return { dir: path.posix.dirname(file), name: manifest.name, manifest }
    }))
    packages.push(...batch.filter(Boolean))
  }
  if (new Set(packages.map(pkg => pkg.name)).size !== packages.length) {
    throw new Error('Duplicate workspace package names')
  }
  return packages
}

/** 同时识别清单键名、npm/workspace 别名和 workspace 相对路径。 */
function dependsOnConstants(pkg, constants) {
  return ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'].some(section =>
    Object.entries(pkg.manifest[section] ?? {}).some(([name, version]) => {
      if (typeof version !== 'string') {
        return false
      }
      if (version.startsWith('workspace:.')) {
        return path.posix.normalize(path.posix.join(pkg.dir, version.slice('workspace:'.length))) === constants.dir
      }
      const alias = /^(?:workspace:|npm:)(@[^/]+\/[^@]+|[^@]+)@.+$/u.exec(version)
        ?? /^npm:(@[^/]+\/[^@]+|[^@]+)$/u.exec(version)
      if (alias) {
        return alias[1] === constants.name
      }
      return name === constants.name
    }),
  )
}

export function affectedPackages(files, workspaces) {
  const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))
    .filter(file => !/(?:^|\/)(?:dist|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file))
  const selected = new Set(workspaces.filter(pkg => paths.some(file => isReleaseWorthyWorkspaceFile(file, pkg.dir))).map(pkg => pkg.name))
  const constants = workspaces.find(pkg => pkg.name === '@weapp-core/constants')
  if (constants && selected.has(constants.name)) {
    for (const pkg of workspaces) {
      if (dependsOnConstants(pkg, constants)) {
        selected.add(pkg.name)
      }
    }
  }
  if (selected.has('weapp-vite') || selected.has('wevu') || paths.some(file => file.startsWith('templates/'))) {
    selected.add('create-weapp-vite')
  }
  return [...selected].sort()
}
