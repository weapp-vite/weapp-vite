import { createHeadlessSession } from '../runtime'
import { HeadlessTestingSessionHandle } from './sessionHandle'

export interface HeadlessTestingLaunchOptions {
  projectPath: string
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
  const initialRoute = resolveInitialRoute(session)
  if (initialRoute) {
    session.reLaunch(`/${initialRoute}`)
  }
  else {
    session.bootstrap()
  }
  return new HeadlessTestingSessionHandle(session.project, session)
}
