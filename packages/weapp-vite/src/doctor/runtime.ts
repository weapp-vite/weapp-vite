import type { MpPlatform } from '../types'
import type { DoctorRuntimeEvidence } from './types'
import { connectOpenedAutomator, resolveProjectAutomatorPort } from 'weapp-ide-cli'

/** 只连接明确已打开的项目，不启动 IDE、不登录、不改变路由或业务状态。 */
export async function probeDoctorRuntime(cwd: string, target: MpPlatform, port?: number): Promise<DoctorRuntimeEvidence> {
  if (target !== 'weapp') {
    throw new Error('所选平台没有已实现的宿主探针')
  }
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new Error('非法 automator 端口')
  }
  const session = await connectOpenedAutomator({
    projectPath: cwd,
    port: port ?? resolveProjectAutomatorPort(cwd),
    timeout: 3_000,
  }) as {
    currentPage: () => Promise<{ path: string } | null>
    toolInfo: () => Promise<unknown>
    disconnect: () => void
  }
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      Promise.all([session.currentPage(), session.toolInfo()]),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('宿主探针超时')), 5_000) }),
    ])
    if (!result[0]?.path || !result[1]) {
      throw new Error('宿主未返回当前页面与工具信息')
    }
    return {
      host: 'wechat-devtools',
      route: result[0].path,
      provider: 'devtools',
      checks: ['Tool.getInfo', 'App.getCurrentPage'],
    }
  }
  finally {
    clearTimeout(timeout)
    session.disconnect()
  }
}
