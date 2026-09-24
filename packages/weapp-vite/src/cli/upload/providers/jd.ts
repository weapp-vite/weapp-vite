import type { PreparedUpload, UploadContext } from '../types'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { loadUploadPackage, requireUploadEnv } from '../tools'

interface JdCi {
  upload: (options: {
    privateKey: string
    projectPath: string
    uv: string
    desc: string
    ignores: string[]
  }) => Promise<{ base64Data?: string, imgUrl?: string }>
}

/** 京东 SDK 不解析 IDE 配置，需要将项目根目录转换为 app.json 所在目录。 */
export async function prepareJdUpload(context: UploadContext): Promise<PreparedUpload> {
  const privateKey = requireUploadEnv(context, 'JD_PRIVATE_KEY')
  let projectPath = context.projectPath
  const configText = await readFile(path.join(projectPath, 'project.config.json'), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (configText !== undefined) {
    let config: unknown
    try {
      config = JSON.parse(configText)
    }
    catch {
      throw new Error('京东项目的 project.config.json 不是有效的 JSON。')
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('京东项目的 project.config.json 必须是 JSON 对象。')
    }
    if ('miniprogramRoot' in config) {
      if (typeof config.miniprogramRoot !== 'string') {
        throw new TypeError('京东项目配置的 miniprogramRoot 必须是字符串。')
      }
      projectPath = path.resolve(projectPath, config.miniprogramRoot)
    }
  }

  // 官方 SDK 对无效项目会直接 exit(0)，必须在执行前拒绝，避免误报上传成功。
  try {
    if (!(await stat(path.join(projectPath, 'app.json'))).isFile()) {
      throw new Error('not a file')
    }
  }
  catch {
    throw new Error('京东上传目录缺少 app.json，请先构建并检查 project.config.json 的 miniprogramRoot。')
  }

  return {
    secrets: [privateKey],
    async run() {
      const ci = await loadUploadPackage<JdCi>('jd-miniprogram-ci', context.cwd)
      return ci.upload({
        privateKey,
        projectPath,
        uv: context.version,
        desc: context.desc,
        ignores: ['node_modules/**/*'],
      })
    },
  }
}
