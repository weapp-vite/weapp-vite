/**
 * @file 无头运行时适配。
 */
/** HeadlessAutomatorLaunchOptions 的类型定义。 */
export interface HeadlessAutomatorLaunchOptions {
  projectPath: string
}
export async function launchHeadlessAutomator(options: HeadlessAutomatorLaunchOptions) {
  const mod = await import('../../../mpcore/packages/simulator/src/testing/launch')
  return await mod.launch({
    projectPath: options.projectPath,
  })
}
