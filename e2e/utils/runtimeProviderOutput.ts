import { WEAPP_VITE_RUNTIME_VIRTUAL_IDS } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

export interface JavaScriptOutputSnapshot {
  code: string
  files: string[]
}

/**
 * 读取构建目录中的全部 JavaScript 产物，用于校验 runtime provider 边界。
 */
export async function readJavaScriptOutput(distRoot: string): Promise<JavaScriptOutputSnapshot> {
  const files = (await fs.readdir(distRoot, { recursive: true }))
    .filter(file => typeof file === 'string' && /\.[cm]?js$/.test(file))
    .map(file => file.replaceAll('\\', '/'))
    .sort()
  const chunks = await Promise.all(
    files.map(file => fs.readFile(path.join(distRoot, file), 'utf8')),
  )

  return {
    code: chunks.join('\n'),
    files,
  }
}

/**
 * 收集仍作为 import/require 模块说明符存在的 runtime 虚拟入口。
 */
export function collectRuntimeVirtualModuleReferences(code: string): string[] {
  return Object.values(WEAPP_VITE_RUNTIME_VIRTUAL_IDS).filter((id) => {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(
      `(?:\\bfrom\\s*['"]${escapedId}['"]|\\brequire\\(\\s*['"]${escapedId}['"]\\s*\\))`,
    ).test(code)
  })
}
