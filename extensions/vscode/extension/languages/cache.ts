import type { DocumentInput } from '@weapp-vite/language-service'

const inputs = new Map<string, DocumentInput>()

/** 纯数据缓存让同步模板查询共享已解析的平台配置，不在查询中执行项目代码。 */
export function getCachedDocumentInput(fileName: string) {
  return inputs.get(fileName)
}

export function setCachedDocumentInput(fileName: string, input: DocumentInput) {
  inputs.delete(fileName)
  inputs.set(fileName, input)
  if (inputs.size > 16) {
    inputs.delete(inputs.keys().next().value!)
  }
}

export function clearCachedDocumentInputs() {
  inputs.clear()
}
