import type { RendererCatalog, RendererOptions } from './types'
import { onUnload, onUnmounted } from 'wevu'
import { createJsonRenderer } from './renderer'

/** 在同步 setup 中创建会话，页面和组件卸载时均释放动作及流。 */
export function useJsonRenderer<C extends RendererCatalog, State extends object>(options: RendererOptions<C, State>) {
  const renderer = createJsonRenderer(options)
  onUnload(renderer.dispose)
  onUnmounted(renderer.dispose)
  return renderer
}
