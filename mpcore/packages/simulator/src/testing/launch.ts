import { createHeadlessSession } from '../runtime'
import { HeadlessTestingSessionHandle } from './sessionHandle'

export interface HeadlessTestingLaunchOptions {
  projectPath: string
}

export async function launch(options: HeadlessTestingLaunchOptions) {
  const session = createHeadlessSession({
    projectPath: options.projectPath,
  })
  session.bootstrap()
  return new HeadlessTestingSessionHandle(session.project, session)
}
