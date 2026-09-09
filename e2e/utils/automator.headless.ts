import type { HeadlessTestingSessionHandle } from '../../mpcore/packages/simulator/src/testing'
import { launch as launchHeadlessSession } from '../../mpcore/packages/simulator/src/testing/launch'

export interface HeadlessAutomatorLaunchOptions {
  projectPath: string
  onSessionCreated?: (session: HeadlessTestingSessionHandle) => void | Promise<void>
}

export async function launchHeadlessAutomator(options: HeadlessAutomatorLaunchOptions) {
  return await launchHeadlessSession({
    projectPath: options.projectPath,
    onSessionCreated: options.onSessionCreated,
  })
}
