import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { resolveReactTemplateHmrCapability } from '../../packages/weapp-vite/src/plugins/react/hmr'
import { createEmittedScriptReader } from '../benchmarkTemplatesHmr/emittedOutput'
import { isDynamicReactTemplate } from './scenarios'

/** 修改前根据源码和首轮编译方式冻结模板能力，不读取修改后的实际交付来调整计划。 */
export function resolveReactTemplateScenarioCapability(source: string, id: string, dynamic: boolean | undefined, runtime: 'standard' | 'stateful') {
  const capability = resolveReactTemplateHmrCapability({ renderMode: dynamic === undefined ? 'auto' : dynamic ? 'dynamic' : 'static' }, id, source)
  if (!capability) {
    throw new Error('React template scenario has no declared compiler capability.')
  }
  return {
    statefulTemplate: runtime === 'stateful',
    classicFallbackReason: capability.fallback.code,
  }
}

/** 动态树内容可以拆入共享 chunk；产物检查必须沿页面实际引用图读取。 */
export async function waitForReactTemplateScriptOutput(options: {
  entryFile: string
  distRoot: string
  marker: string
  contains: boolean
} & WorkspaceHmrAuditBudget): Promise<void> {
  const read = createEmittedScriptReader(options.entryFile, options.distRoot)
  let lastError: unknown
  while (Date.now() < options.deadline) {
    options.signal?.throwIfAborted()
    try {
      const source = await read()
      options.signal?.throwIfAborted()
      if (source.trim() && source.includes(options.marker) === options.contains && Date.now() < options.deadline) {
        return
      }
    }
    catch (error) {
      options.signal?.throwIfAborted()
      lastError = error
    }
    await sleep(Math.min(25, Math.max(0, options.deadline - Date.now())), undefined, { signal: options.signal })
  }
  throw new Error('React template output does not match the current source mutation.', { cause: lastError })
}

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
