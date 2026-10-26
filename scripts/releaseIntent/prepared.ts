import type { PublishableWorkspacePackageEntry } from '../check-publishable-workspace-changeset'
import type { NativeProjection } from './nativeProjection'
import { isDeepStrictEqual } from 'node:util'
import { parse } from 'yaml'

interface PreparedReleaseOptions {
  headRef: string
  packages: PublishableWorkspacePackageEntry[]
  changedFiles: string[]
  isReleaseWorthy: (file: string, directory: string) => boolean
  project: () => Promise<NativeProjection>
  readBase: (file: string) => Promise<string | undefined>
  readHead: (file: string) => Promise<string | undefined>
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseRecord(text: string | undefined, yaml = false) {
  if (!text) {
    return undefined
  }
  const value: unknown = yaml ? parse(text, { maxAliasCount: 20 }) : JSON.parse(text)
  return record(value) ? value : undefined
}

/** 仅接纳新增版本段；旧 changelog 必须原样保留。 */
function hasPreparedChangelog(before: string | undefined, after: string | undefined, version: string) {
  if (!after) {
    return false
  }
  before = before?.replaceAll('\r\n', '\n')
  after = after.replaceAll('\r\n', '\n')
  const first = after.indexOf(`\n## ${version}\n`)
  if (first < 0) {
    return false
  }
  const next = after.indexOf('\n## ', first + 1)
  if (!before || !before.includes('\n## ')) {
    return next < 0 && (!before || after.slice(0, first).trim() === before.trim())
  }
  return next > first && after.slice(0, first).trim() === before.slice(0, before.indexOf('\n## ')).trim()
    && after.slice(next).trim() === before.slice(before.indexOf('\n## ')).trim()
}

/** 分支名只选择检查方式，不能代替版本、账本和已消费 intent 的证据。 */
export async function collectPreparedReleasePackages(options: PreparedReleaseOptions) {
  const result = new Set<string>()
  if (!/^(?:release\/pnpm-version(?:-(?:alpha|beta|rc|next))?|pnpm-release\/(?:main|alpha|beta|rc|next))$/u.test(options.headRef)) {
    return result
  }
  const [projection, afterText] = await Promise.all([options.project(), options.readHead('.changeset/ledger.yaml')])
  const afterLedger = parseRecord(afterText, true)
  if (!afterLedger || !isDeepStrictEqual(projection.ledger, afterLedger)
    || (await Promise.all(projection.consumed.map(file => options.readHead(file)))).some(value => value !== undefined)) {
    return result
  }
  for (const pkg of options.packages) {
    const manifestPath = `${pkg.dir}/package.json`
    const changelogPath = `${pkg.dir}/CHANGELOG.md`
    const ownChanges = options.changedFiles.filter(file => file === changelogPath || options.isReleaseWorthy(file, pkg.dir))
    if (!ownChanges.includes(manifestPath) || !ownChanges.includes(changelogPath)
      || ownChanges.some(file => ![manifestPath, changelogPath].includes(file))) {
      continue
    }
    const [beforeManifest, afterManifest, beforeLog, afterLog] = await Promise.all([
      options.readBase(manifestPath),
      options.readHead(manifestPath),
      options.readBase(changelogPath),
      options.readHead(changelogPath),
    ])
    const before = parseRecord(beforeManifest)
    const after = parseRecord(afterManifest)
    const version = projection.versions.find(entry => entry.name === pkg.name)
    if (!before || !after || !version || after.name !== pkg.name || after.version === before.version
      || version.currentVersion !== before.version || version.newVersion !== after.version
      || !isDeepStrictEqual(projection.manifests.get(manifestPath), after)
      || !hasPreparedChangelog(beforeLog, afterLog, version.newVersion)) {
      continue
    }
    result.add(pkg.name)
  }
  return result
}
