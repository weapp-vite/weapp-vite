import type { MermaidConfig } from 'mermaid'

let pending: Promise<unknown> = Promise.resolve()

/** 将配置与渲染放在同一队列任务，避免多个图表共享 Mermaid 配置时互相覆盖。 */
export function renderDiagram(id: string, source: string, config: MermaidConfig) {
  const result = pending.then(async () => {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize(config)
    return mermaid.render(id, source)
  })
  pending = result.catch(() => {})
  return result
}
