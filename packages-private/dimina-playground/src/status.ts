/** 构建错误跨越异步启动保留；只有成功重建触发的整页重载才能清除。 */
export function createStatusReporter(example: string, render: (message: string) => void) {
  let opened = false
  let launchError: string | undefined
  let buildError: string | undefined
  const update = () => render(buildError !== undefined
    ? `构建失败：${buildError}`
    : launchError !== undefined
      ? `启动失败：${launchError}`
      : opened ? `${example} 示例已打开` : '正在启动…')
  return {
    opened() {
      opened = true
      update()
    },
    launchFailed(message: string) {
      launchError = message
      update()
    },
    buildFailed(message: string) {
      buildError = message
      update()
    },
  }
}
