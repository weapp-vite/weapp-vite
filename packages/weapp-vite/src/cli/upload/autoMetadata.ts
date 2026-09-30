import type { UploadCLIOptions } from './options'
import type { UploadAction } from './types'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import semverInc from 'semver/functions/inc.js'
import { x } from 'tinyexec'
import logger from '../../logger'

/** 只读取命令根目录的清单，不向父目录查找或修改文件。 */
async function readPackageVersion(packagePath: string): Promise<string> {
  let manifest: unknown
  try {
    manifest = JSON.parse(await readFile(packagePath, 'utf8'))
  }
  catch (cause) {
    throw new Error('--bump 无法读取命令根目录的 package.json。', { cause })
  }
  if (manifest === null || typeof manifest !== 'object' || !('version' in manifest) || typeof manifest.version !== 'string') {
    throw new Error('--bump 要求命令根目录 package.json 的 version 为有效的 SemVer 字符串。')
  }
  return manifest.version
}

/** 在首次编译配置求值前准备一次元数据；预演不写文件，实际版本由 npm 同步。 */
export function validateAutoUploadMetadata(options: UploadCLIOptions, action: UploadAction) {
  const { bump, gitDesc } = options
  if (action === 'preview' && (bump !== undefined || gitDesc !== undefined)) {
    throw new Error('--bump 和 --git-desc 仅支持 upload 或 build --upload，不支持 preview。')
  }
  if (bump !== undefined && options.uv !== undefined) {
    throw new Error('--bump 不能与 --uv 同时使用。')
  }
  if (gitDesc && options.desc !== undefined) {
    throw new Error('--git-desc 不能与 --desc 同时使用。')
  }
  if (bump !== undefined && !['patch', 'minor', 'major'].includes(bump)) {
    throw new Error('--bump 仅支持 patch、minor 或 major。')
  }
}

interface MetadataSnapshot {
  path: string
  content?: string
}

async function captureMetadataSnapshot(root: string): Promise<MetadataSnapshot[]> {
  const snapshots: MetadataSnapshot[] = []
  for (const name of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json']) {
    const filePath = path.join(root, name)
    try {
      snapshots.push({ path: filePath, content: await readFile(filePath, 'utf8') })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      snapshots.push({ path: filePath })
    }
  }
  return snapshots
}

async function restoreMetadataSnapshot(snapshots: MetadataSnapshot[]) {
  for (const snapshot of snapshots) {
    if (snapshot.content === undefined) {
      await rm(snapshot.path, { force: true })
    }
    else {
      await writeFile(snapshot.path, snapshot.content)
    }
  }
}

export async function prepareAutoUploadMetadata(cwd: string, options: UploadCLIOptions, action: UploadAction): Promise<UploadCLIOptions> {
  validateAutoUploadMetadata(options, action)
  const { bump, gitDesc } = options
  if (bump === undefined && !gitDesc) {
    return options
  }
  if (bump !== undefined && options.uv !== undefined) {
    throw new Error('--bump 不能与 --uv 同时使用。')
  }
  if (gitDesc && options.desc !== undefined) {
    throw new Error('--git-desc 不能与 --desc 同时使用。')
  }
  if (bump !== undefined && bump !== 'patch' && bump !== 'minor' && bump !== 'major') {
    throw new Error('--bump 仅支持 patch、minor 或 major。')
  }

  const root = path.resolve(cwd)
  const packagePath = path.join(root, 'package.json')
  let currentVersion: string | undefined
  let nextVersion: string | undefined
  if (bump !== undefined) {
    currentVersion = await readPackageVersion(packagePath)
    nextVersion = semverInc(currentVersion, bump) ?? undefined
    if (!nextVersion) {
      throw new Error('--bump 要求命令根目录 package.json 的 version 为有效的 SemVer 字符串。')
    }
  }

  let desc: string | undefined
  if (gitDesc) {
    try {
      const result = await x('git', ['log', '-1', '--format=%s'], {
        nodePath: false,
        throwOnError: true,
        nodeOptions: { cwd: root },
      })
      desc = result.stdout.trim()
    }
    catch (cause) {
      throw new Error('--git-desc 无法读取最新 Git 提交主题，请确认 Git 可用且仓库已有提交。', { cause })
    }
    if (!desc) {
      throw new Error('--git-desc 要求最新 Git 提交主题非空。')
    }
  }

  if (nextVersion) {
    if (options.dryRun) {
      logger.info(`[upload] dry-run：计划版本 ${currentVersion} → ${nextVersion}，未修改 package.json 或锁文件。`)
    }
    else {
      try {
        await x('npm', ['version', nextVersion, '--no-git-tag-version', '--ignore-scripts', '--workspaces=false', '--prefix', root], {
          nodePath: false,
          throwOnError: true,
          nodeOptions: { cwd: root },
        })
      }
      catch (cause) {
        throw new Error('--bump 执行 npm version 失败，请检查本地版本与锁文件后重试。', { cause })
      }
      if (await readPackageVersion(packagePath) !== nextVersion) {
        throw new Error('--bump 执行 npm version 后，命令根目录的 package.json 版本未按预期更新。')
      }
      logger.info(`[upload] 版本已更新：${currentVersion} → ${nextVersion}。后续构建或上传失败不会回退；重试同一版本时请移除 --bump。`)
    }
  }
  if (gitDesc) {
    logger.info('[upload] 使用最新 Git 提交主题作为上传说明。')
  }
  const metadata = { ...options }
  if (nextVersion !== undefined) {
    metadata.uv = nextVersion
  }
  if (desc !== undefined) {
    metadata.desc = desc
  }
  return metadata
}

/** 配置尚未确认可上传时，保留 npm version 所有可能修改文件的回滚点。 */
export async function prepareAutoUploadMetadataWithRollback(cwd: string, options: UploadCLIOptions, action: UploadAction): Promise<{ options: UploadCLIOptions, rollback: () => Promise<void> }> {
  validateAutoUploadMetadata(options, action)
  const snapshots = options.bump !== undefined && !options.dryRun ? await captureMetadataSnapshot(path.resolve(cwd)) : []
  const metadata = await prepareAutoUploadMetadata(cwd, options, action)
  return { options: metadata, rollback: () => restoreMetadataSnapshot(snapshots) }
}
