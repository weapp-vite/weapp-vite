import type { UploadPlatform } from './types'
import { access, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { getProjectPlatformOptions } from '../../platform'

/** 确保官方工具读取的目录正是本次构建输出，拒绝误传旧目录或同名配置。 */
export async function validateUploadProject(options: {
  platform: UploadPlatform
  projectPath: string
  outDir: string
  sourceConfigPath?: string
}) {
  const { projectConfigFileName } = getProjectPlatformOptions(options.platform)
  if (options.sourceConfigPath && path.basename(options.sourceConfigPath) !== projectConfigFileName) {
    throw new Error(`上传工具只读取 ${projectConfigFileName}，请使用此标准文件名，避免读取其他项目配置。`)
  }
  const configPath = path.join(options.projectPath, projectConfigFileName)
  const config: unknown = JSON.parse(await readFile(configPath, 'utf8'))
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(`${projectConfigFileName} 必须是 JSON 对象。`)
  }
  // srcMiniprogramRoot 是源码侧兼容字段，不能用它替代 SDK 实际读取的产物根目录。
  const rootKey = options.platform === 'swan' ? 'smartProgramRoot' : 'miniprogramRoot'
  const root = (config as Record<string, unknown>)[rootKey]
  if (typeof root !== 'string' || !root.trim()) {
    throw new Error(`${projectConfigFileName} 缺少代码目录 ${rootKey}。`)
  }
  const sdkRoot = path.resolve(options.projectPath, root)
  const [actualRoot, outputRoot] = await Promise.all([
    realpath(sdkRoot),
    realpath(options.outDir),
  ])
  if (actualRoot !== outputRoot) {
    throw new Error(`${projectConfigFileName} 的代码目录与本次构建输出不一致，已阻止上传旧产物。请检查项目配置根目录与 build.outDir。`)
  }
  await access(path.join(outputRoot, 'app.json'))
}
