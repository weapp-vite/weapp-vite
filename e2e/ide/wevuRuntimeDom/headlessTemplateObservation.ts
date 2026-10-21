import { resolveRuntimeProviderName } from '../../utils/runtimeProvider'

interface TemplateObservationSession {
  currentPage: (options: { appFunctionFallback: false }) => Promise<{ wxml: () => Promise<string> } | null>
}

/** headless 按需读取当前模板，推进绑定与 observer；真实 IDE 仍等待宿主自动刷新。 */
export async function observeHeadlessCurrentTemplate(miniProgram: TemplateObservationSession) {
  if (resolveRuntimeProviderName() !== 'headless') {
    return
  }
  const page = await miniProgram.currentPage({ appFunctionFallback: false })
  if (!page) {
    throw new Error('Cannot observe the headless template without a current page.')
  }
  await page.wxml()
}
