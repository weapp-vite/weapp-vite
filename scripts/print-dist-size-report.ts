import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { colors } from '@weapp-core/logger'

interface WorkspacePackage {
  dir: string
  name: string
  relativeDir: string
}

interface DistSizeEntry extends WorkspacePackage {
  bytes: number
  fileCount: number
}

interface DistSizeGroup {
  key: 'packages' | 'e2e-apps'
  label: string
  entries: DistSizeEntry[]
}

const ROOT = process.cwd()
const WORKSPACE_DIRS = ['packages', '@weapp-core', 'e2e-apps', 'extensions']
const INFO_COLOR = colors.cyan
const MUTED_COLOR = colors.dim

/**
 * @description 将字节数格式化为易读体积。
 */
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

/**
 * @description 递归统计目录体积与文件数。
 */
async function getDirectorySize(dir: string): Promise<{ bytes: number, fileCount: number }> {
  let bytes = 0
  let fileCount = 0
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const child = await getDirectorySize(target)
      bytes += child.bytes
      fileCount += child.fileCount
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const fileStat = await stat(target)
    bytes += fileStat.size
    fileCount += 1
  }

  return { bytes, fileCount }
}

/**
 * @description 根据体积分级返回染色函数。
 */
function resolveSizeColor(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return colors.red
  }
  if (bytes >= 256 * 1024) {
    return colors.yellow
  }
  return colors.green
}

/**
 * @description 返回包所属展示分组。
 */
function resolveGroupKey(relativeDir: string): DistSizeGroup['key'] {
  return relativeDir.startsWith('e2e-apps/') ? 'e2e-apps' : 'packages'
}

/**
 * @description 输出单个分组的体积列表。
 */
function printGroup(group: DistSizeGroup, totalBytes: number) {
  if (group.entries.length === 0) {
    return
  }

  const groupBytes = group.entries.reduce((sum, item) => sum + item.bytes, 0)
  const groupFiles = group.entries.reduce((sum, item) => sum + item.fileCount, 0)
  const nameWidth = Math.max('Package'.length, ...group.entries.map(item => item.name.length))
  const sizeWidth = Math.max('Dist Size'.length, ...group.entries.map(item => formatBytes(item.bytes).length))
  const fileWidth = Math.max('Files'.length, ...group.entries.map(item => String(item.fileCount).length))
  const separator = '─'.repeat(Math.max(72, nameWidth + sizeWidth + fileWidth + 24))

  console.log('')
  console.log(colors.bold(group.label))
  console.log(MUTED_COLOR(separator))

  for (const item of group.entries) {
    const sizeText = formatBytes(item.bytes).padStart(sizeWidth)
    const color = resolveSizeColor(item.bytes)
    const name = item.name.padEnd(nameWidth)
    const files = String(item.fileCount).padStart(fileWidth)
    const barUnits = Math.max(1, Math.min(24, Math.round((item.bytes / Math.max(totalBytes, 1)) * 24)))
    const bar = color('█'.repeat(barUnits)) + MUTED_COLOR('░'.repeat(24 - barUnits))
    console.log(`${INFO_COLOR(name)}  ${color(sizeText)}  ${MUTED_COLOR(`${files} files`)}  ${bar}`)
    console.log(`${MUTED_COLOR(' '.repeat(nameWidth + 2))}${MUTED_COLOR(item.relativeDir)}`)
  }

  console.log(MUTED_COLOR(separator))
  console.log(
    `${colors.bold(`${group.label} Total`)}  ${colors.bold(formatBytes(groupBytes))}  ${MUTED_COLOR(`${groupFiles} files`)}`,
  )
}

/**
 * @description 读取工作区包信息。
 */
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
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string }
        packages.push({
          dir,
          name: packageJson.name ?? path.relative(ROOT, dir),
          relativeDir: path.relative(ROOT, dir),
        })
      }
      catch {
        continue
      }
    }
  }

  return packages
}

/**
 * @description 输出已构建包 dist 体积汇总。
 */
async function printDistSizeReport() {
  const workspacePackages = await collectWorkspacePackages()
  const entries: DistSizeEntry[] = []

  for (const item of workspacePackages) {
    const distDir = path.join(item.dir, 'dist')
    try {
      const distStat = await stat(distDir)
      if (!distStat.isDirectory()) {
        continue
      }
      const { bytes, fileCount } = await getDirectorySize(distDir)
      entries.push({
        ...item,
        bytes,
        fileCount,
      })
    }
    catch {
      continue
    }
  }

  entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))

  const totalBytes = entries.reduce((sum, item) => sum + item.bytes, 0)
  const totalFiles = entries.reduce((sum, item) => sum + item.fileCount, 0)
  const groups: DistSizeGroup[] = [
    {
      key: 'packages',
      label: 'Packages',
      entries: entries.filter(item => resolveGroupKey(item.relativeDir) === 'packages'),
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
    printGroup(group, totalBytes)
  }
  console.log('')
  console.log(
    `${colors.bold('Total')}  ${colors.bold(formatBytes(totalBytes))}  ${MUTED_COLOR(`${totalFiles} files`)}`,
  )
}

await printDistSizeReport()
