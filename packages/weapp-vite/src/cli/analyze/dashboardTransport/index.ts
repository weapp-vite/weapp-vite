import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

interface DashboardTransportModules {
  '@devframes/agentic/mcp': typeof import('@devframes/agentic/mcp')
  '@devframes/hub/initiate': typeof import('@devframes/hub/initiate')
  '@devframes/hub-ui': typeof import('@devframes/hub-ui')
  'devframe/initiate': typeof import('devframe/initiate')
  'devframe/node/auth': typeof import('devframe/node/auth')
}

/** 从已选 Dashboard 的安装位置解析传输依赖，兼容嵌套安装和包管理器的虚拟目录。 */
export async function loadDashboardTransportModule<Specifier extends keyof DashboardTransportModules>(
  packageJsonPath: string,
  specifier: Specifier,
): Promise<DashboardTransportModules[Specifier]> {
  const require = createRequire(packageJsonPath)
  let resolved: string
  try {
    resolved = require.resolve(specifier)
  }
  catch (error) {
    throw new Error(`[weapp-vite ui] 已安装的 Dashboard 无法解析传输依赖 ${specifier}，请重新安装或更新 @weapp-vite/dashboard。`, { cause: error })
  }
  // 模块内部的执行错误保留原样，不能把依赖自身的失败误报为未安装。
  return import(pathToFileURL(resolved).href) as Promise<DashboardTransportModules[Specifier]>
}
