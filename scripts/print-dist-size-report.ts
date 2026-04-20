import { spawnSync } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'
import { colors } from '@weapp-core/logger'

interface WorkspacePackage {
  dir: string
  name: string
  relativeDir: string
  private: boolean
}

interface DistSizeEntry extends WorkspacePackage {
  bytes: number
  gzipBytes: number
  fileCount: number
}

interface PublishSizeEntry extends WorkspacePackage {
  packedBytes: number
  unpackedBytes: number
  fileCount: number
  filename: string
}

interface SizeGroup<TEntry> {
  key: 'packages' | 'packages-runtime' | 'e2e-apps'
  label: string
  entries: TEntry[]
}

const ROOT = process.cwd()
const WORKSPACE_DIRS = ['packages', 'packages-runtime', '@weapp-core', 'e2e-apps', 'extensions']
const INFO_COLOR = colors.cyan
const MUTED_COLOR = colors.dim
const NPM_PACK_CACHE_DIR = path.join(ROOT, '.cache', 'npm-pack-report')
const ENABLE_PUBLISH_SIZE_REPORT = process.env.WEAPP_VITE_REPORT_PUBLISH_SIZE === '1'

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

async function getDirectorySize(dir: string): Promise<{ bytes: number, gzipBytes: number, fileCount: number }> {
  let bytes = 0
  let gzipBytes = 0
  let fileCount = 0
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const child = await getDirectorySize(target)
      bytes += child.bytes
      gzipBytes += child.gzipBytes
      fileCount += child.fileCount
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const fileStat = await stat(target)
    const content = await readFile(target)
    bytes += fileStat.size
    gzipBytes += gzipSync(content, { level: 9 }).byteLength
    fileCount += 1
  }

  return { bytes, gzipBytes, fileCount }
}

function resolveSizeColor(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return colors.red
  }
  if (bytes >= 256 * 1024) {
    return colors.yellow
  }
  return colors.green
}

function resolveGroupKey(relativeDir: string): SizeGroup<unknown>['key'] {
  if (relativeDir.startsWith('packages-runtime/')) {
    return 'packages-runtime'
  }
  return relativeDir.startsWith('e2e-apps/') ? 'e2e-apps' : 'packages'
}

function printGroup<TEntry extends { bytes?: number, packedBytes?: number, unpackedBytes?: number, fileCount: number, name: string, relativeDir: string }>(
  group: SizeGroup<TEntry>,
  totalBytes: number,
  options: {
    title: string
    getSize: (entry: TEntry) => number
    renderSuffix?: (entry: TEntry) => string
  },
) {
  if (group.entries.length === 0) {
    return
  }

  const groupBytes = group.entries.reduce((sum, item) => sum + options.getSize(item), 0)
  const groupFiles = group.entries.reduce((sum, item) => sum + item.fileCount, 0)
  const nameWidth = Math.max('Package'.length, ...group.entries.map(item => item.name.length))
  const sizeWidth = Math.max(options.title.length, ...group.entries.map(item => formatBytes(options.getSize(item)).length))
  const fileWidth = Math.max('Files'.length, ...group.entries.map(item => String(item.fileCount).length))
  const separator = '─'.repeat(Math.max(72, nameWidth + sizeWidth + fileWidth + 24))

  console.log('')
  console.log(colors.bold(group.label))
  console.log(MUTED_COLOR(separator))

  for (const item of group.entries) {
    const itemBytes = options.getSize(item)
    const sizeText = formatBytes(itemBytes).padStart(sizeWidth)
    const color = resolveSizeColor(itemBytes)
    const name = item.name.padEnd(nameWidth)
    const files = String(item.fileCount).padStart(fileWidth)
    const barUnits = Math.max(1, Math.min(24, Math.round((itemBytes / Math.max(totalBytes, 1)) * 24)))
    const bar = color('█'.repeat(barUnits)) + MUTED_COLOR('░'.repeat(24 - barUnits))
    console.log(`${INFO_COLOR(name)}  ${color(sizeText)}  ${MUTED_COLOR(`${files} files`)}  ${bar}`)
    console.log(`${MUTED_COLOR(' '.repeat(nameWidth + 2))}${MUTED_COLOR(item.relativeDir)}`)
    const suffix = options.renderSuffix?.(item)
    if (suffix) {
      console.log(`${MUTED_COLOR(' '.repeat(nameWidth + 2))}${MUTED_COLOR(suffix)}`)
    }
  }

  console.log(MUTED_COLOR(separator))
  console.log(
    `${colors.bold(`${group.label} Total`)}  ${colors.bold(formatBytes(groupBytes))}  ${MUTED_COLOR(`${groupFiles} files`)}`,
  )
}

async function collectWorkspacePackages() {
  const packages: WorkspacePackage[] = []

  for (const dirName of WORKSPACE_DIRS) {
    const baseDir = path.join(ROOT, dirName)
    let children: Awaited<ReturnType<typeof readdir>>
    try {
      children = await readdir(baseDir, { withFileTypes: true })
    }
    catch {
      continue
    }

    for (const child of children) {
      if (!child.isDirectory()) {
        continue
      }

      const dir = path.join(baseDir, child.name)
      const packageJsonPath = path.join(dir, 'package.json')
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string, private?: boolean }
        packages.push({
          dir,
          name: packageJson.name ?? path.relative(ROOT, dir),
          relativeDir: path.relative(ROOT, dir),
          private: Boolean(packageJson.private),
        })
      }
      catch {
        continue
      }
    }
  }

  return packages
}

async function collectDistEntries(workspacePackages: WorkspacePackage[]) {
  const entries: DistSizeEntry[] = []

  for (const item of workspacePackages) {
    const distDir = path.join(item.dir, 'dist')
    try {
      const distStat = await stat(distDir)
      if (!distStat.isDirectory()) {
        continue
      }
      const { bytes, gzipBytes, fileCount } = await getDirectorySize(distDir)
      entries.push({
        ...item,
        bytes,
        gzipBytes,
        fileCount,
      })
    }
    catch {
      continue
    }
  }

  entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
  return entries
}

function collectPublishEntries(workspacePackages: WorkspacePackage[]) {
  const entries: PublishSizeEntry[] = []

  for (const item of workspacePackages) {
    if (item.private) {
      continue
    }

    const result = spawnSync('npm', ['pack', '--json', '--dry-run'], {
      cwd: item.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: NPM_PACK_CACHE_DIR,
      },
    })

    if (result.status !== 0) {
      continue
    }

    const stdout = result.stdout.trim()
    if (!stdout) {
      continue
    }

    try {
      const parsed = JSON.parse(stdout) as Array<{
        filename?: string
        size?: number
        unpackedSize?: number
        files?: Array<unknown>
      }> | {
        filename?: string
        size?: number
        unpackedSize?: number
        files?: Array<unknown>
      }
      const pack = Array.isArray(parsed) ? parsed[0] : parsed
      if (!pack?.size || !pack?.unpackedSize) {
        continue
      }
      entries.push({
        ...item,
        packedBytes: pack.size,
        unpackedBytes: pack.unpackedSize,
        fileCount: pack.files?.length ?? 0,
        filename: pack.filename ?? '',
      })
    }
    catch {
      continue
    }
  }

  entries.sort((a, b) => b.unpackedBytes - a.unpackedBytes || a.name.localeCompare(b.name))
  return entries
}

async function printDistSizeReport(workspacePackages: WorkspacePackage[]) {
  const entries = await collectDistEntries(workspacePackages)
  const totalBytes = entries.reduce((sum, item) => sum + item.bytes, 0)
  const totalGzipBytes = entries.reduce((sum, item) => sum + item.gzipBytes, 0)
  const totalFiles = entries.reduce((sum, item) => sum + item.fileCount, 0)
  const groups: Array<SizeGroup<DistSizeEntry>> = [
    {
      key: 'packages',
      label: 'Packages',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'packages'),
    },
    {
      key: 'packages-runtime',
      label: 'Runtime Packages',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'packages-runtime'),
    },
    {
      key: 'e2e-apps',
      label: 'E2E Apps',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'e2e-apps'),
    },
  ]

  console.log('')
  console.log(colors.bold(colors.bgCyan(colors.black(' Dist Size Report '))))
  console.log(MUTED_COLOR(`Built packages with dist output: ${entries.length}`))
  for (const group of groups) {
    printGroup(group, totalBytes, {
      title: 'Dist Size',
      getSize: entry => entry.bytes,
      renderSuffix: entry => `gzip ${formatBytes(entry.gzipBytes)}`,
    })
  }
  console.log('')
  console.log(
    `${colors.bold('Total')}  ${colors.bold(formatBytes(totalBytes))}  ${MUTED_COLOR(`${totalFiles} files`)}`,
  )
  console.log(
    `${colors.bold('Total (gzip)')}  ${colors.bold(formatBytes(totalGzipBytes))}  ${MUTED_COLOR(`${totalFiles} files`)}`,
  )
}

function printPublishSizeReport(workspacePackages: WorkspacePackage[]) {
  const entries = collectPublishEntries(workspacePackages)
  const totalPackedBytes = entries.reduce((sum, item) => sum + item.packedBytes, 0)
  const totalUnpackedBytes = entries.reduce((sum, item) => sum + item.unpackedBytes, 0)
  const totalFiles = entries.reduce((sum, item) => sum + item.fileCount, 0)
  const groups: Array<SizeGroup<PublishSizeEntry>> = [
    {
      key: 'packages',
      label: 'Publishable Packages',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'packages'),
    },
    {
      key: 'e2e-apps',
      label: 'Publishable E2E Apps',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'e2e-apps'),
    },
  ]

  console.log('')
  console.log(colors.bold(colors.bgMagenta(colors.black(' NPM Publish Size Report '))))
  console.log(MUTED_COLOR(`Publishable packages: ${entries.length}`))
  for (const group of groups) {
    printGroup(group, totalUnpackedBytes, {
      title: 'Unpacked',
      getSize: entry => entry.unpackedBytes,
      renderSuffix: entry => `packed ${formatBytes(entry.packedBytes)} · ${entry.filename || 'npm pack --dry-run'}`,
    })
  }
  console.log('')
  console.log(
    `${colors.bold('Packed Total')}  ${colors.bold(formatBytes(totalPackedBytes))}  ${MUTED_COLOR(`${totalFiles} files`)}`,
  )
  console.log(
    `${colors.bold('Unpacked Total')}  ${colors.bold(formatBytes(totalUnpackedBytes))}  ${MUTED_COLOR(`${totalFiles} files`)}`,
  )
}

async function main() {
  const workspacePackages = await collectWorkspacePackages()
  await printDistSizeReport(workspacePackages)
  if (ENABLE_PUBLISH_SIZE_REPORT) {
    printPublishSizeReport(workspacePackages)
  }
  else {
    console.log('')
    console.log(MUTED_COLOR('NPM publish size report disabled. Set WEAPP_VITE_REPORT_PUBLISH_SIZE=1 to enable.'))
  }
}

await main()
