import type { HeadlessTestingLaunchOptions } from '../../mpcore/packages/simulator/src/testing/launch'
import { launch as launchHeadlessSession } from '../../mpcore/packages/simulator/src/testing/launch'

export interface HeadlessAutomatorLaunchOptions {
  projectPath: string
  configureSession?: HeadlessTestingLaunchOptions['configureSession']
}

export async function launchHeadlessAutomator(options: HeadlessAutomatorLaunchOptions) {
  return await launchHeadlessSession({
    configureSession: options.configureSession,
    projectPath: options.projectPath,
  })
}
