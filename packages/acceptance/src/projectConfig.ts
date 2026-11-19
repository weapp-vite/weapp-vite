import { readFile } from 'node:fs/promises'
import { safePath } from '@weapp-agent/core/project'

/** 验收入口区分缺少项目根配置与配置内容损坏，不将其误报为 IDE 连接失败。 */
export async function readRuntimeProjectConfig(root: string): Promise<Record<string, unknown>> {
  let source: string
  try {
    source = await readFile(await safePath(root, 'project.config.json'), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    throw new Error('Missing project.config.json: acceptance requires a WeChat DevTools project root. For standalone build artifacts, inherit the real appid and libVersion from the source project and set miniprogramRoot to "./".')
  }
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch (cause) {
    throw new Error('Invalid project.config.json: expected a JSON object. Repair the project configuration before runtime checks.', { cause })
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid project.config.json: expected a JSON object. Repair the project configuration before runtime checks.')
  }
  return value as Record<string, unknown>
}
