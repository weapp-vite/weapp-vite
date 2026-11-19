import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** 在任何 IDE 操作之前区分项目根与小程序产物根，并保留配置读取的实际错误。 */
export async function readAutomatorProjectConfig(projectPath: string): Promise<Record<string, unknown>> {
  const file = path.resolve(projectPath, 'project.config.json')
  let source: string
  try {
    source = await readFile(file, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    throw new Error(`目标目录缺少 project.config.json：${file}。automator 的 --project 指向项目根，而不是仅含 app.json 的小程序产物根。请指定包含项目配置的目录；若需直接打开此产物，请从源码项目配置继承真实 appid 和 libVersion，并添加配置：{"compileType":"miniprogram","miniprogramRoot":"./","appid":"<源码项目真实 AppID>","libVersion":"<源码项目基础库版本>"}。`)
  }
  let config: unknown
  try {
    config = JSON.parse(source)
  }
  catch (cause) {
    throw new Error(`project.config.json 必须是有效的 JSON 对象：${file}。请修复后重试。`, { cause })
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`project.config.json 必须是有效的 JSON 对象：${file}。请修复后重试。`)
  }
  return config as Record<string, unknown>
}
