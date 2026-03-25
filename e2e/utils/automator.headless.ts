import { launch as launchHeadlessSession } from '../../mpcore/packages/simulator/src/testing/launch'

export interface HeadlessAutomatorLaunchOptions {
  projectPath: string
}

export async function launchHeadlessAutomator(options: HeadlessAutomatorLaunchOptions) {
  return await launchHeadlessSession({
    projectPath: options.projectPath,
  })
}
