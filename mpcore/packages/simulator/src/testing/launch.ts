import { createHeadlessSession } from '../runtime'
import { HeadlessTestingSessionHandle } from './sessionHandle'

export interface HeadlessTestingLaunchOptions {
  projectPath: string
  onSessionCreated?: (session: HeadlessTestingSessionHandle) => void | Promise<void>
}

function resolveInitialRoute(session: ReturnType<typeof createHeadlessSession>) {
  const entryPagePath = typeof session.project.appConfig.entryPagePath === 'string'
    ? session.project.appConfig.entryPagePath.trim().replace(/^\/+/, '')
    : ''
  if (entryPagePath && session.project.routes.some(route => route.route === entryPagePath)) {
    return entryPagePath
  }
  return session.project.routes[0]?.route ?? null
}

export async function launch(options: HeadlessTestingLaunchOptions) {
  const session = createHeadlessSession({
    projectPath: options.projectPath,
  })
  const handle = new HeadlessTestingSessionHandle(session.project, session)
  try {
    await options.onSessionCreated?.(handle)
    const initialRoute = resolveInitialRoute(session)
    if (initialRoute) {
      // 首次导航负责以实际入口 path/query 启动 App，再挂载首屏；不能先锁定空启动参数。
      session.reLaunch(`/${initialRoute}`)
    }
    else {
      session.bootstrap()
    }
    return handle
  }
  catch (error) {
    session.close()
    throw error
  }
}
