import { readFile } from 'node:fs/promises'
import { isDynamicReactTemplate } from './scenarios'

/** 构建前允许尚无模板，构建后必须读取真实产物；其他读取错误始终保留。 */
export async function isDynamicReactTemplateOutput(filename: string, requireOutput: boolean) {
  let source: string
  try {
    source = await readFile(filename, 'utf8')
  }
  catch (error) {
    if (!requireOutput && error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
  return isDynamicReactTemplate(source)
}
