import type { HeadlessTestingSessionHandle } from '../../mpcore/packages/simulator/src/testing'
import { installStatefulHmrTransport } from '../../e2e/utils/statefulHmrTransport'
import { launch } from '../../mpcore/packages/simulator/src/testing/launch'

/** JS 由 mpcore 执行，stateful 使用实际回环 transport 与 emitted delta；不伪造消费确认。 */
export class FrameworkSequenceRuntime {
  private runtime?: HeadlessTestingSessionHandle
  private stopTransport?: () => void

  constructor(private readonly root: string, private readonly outDir: string, private readonly stateful: boolean) {}

  async start() {
    await this.close()
    this.runtime = await launch({
      projectPath: this.root,
      configureSession: (session) => {
        if (this.stateful) {
          this.stopTransport = installStatefulHmrTransport(session, this.outDir)
        }
      },
    })
  }

  async currentMessage() {
    return (await this.runtime?.currentPage())?.data('message')
  }

  async observe(routes: string[]) {
    if (!this.runtime) {
      throw new Error('Framework runtime must be started before observation')
    }
    const pages: Record<string, unknown> = {}
    for (const route of routes) {
      const page = await this.runtime.reLaunch(`/${route}`)
      const snapshot = await page.snapshot()
      // 不比较 runtime 生成的页面/节点身份；全部页面 data、query、逻辑文本和 WXML 都保留。
      pages[route] = { data: snapshot.data, query: snapshot.query, text: snapshot.root.text, wxml: snapshot.wxml }
    }
    await this.runtime.reLaunch(`/${routes[0]}`)
    return pages
  }

  async close() {
    this.stopTransport?.()
    this.stopTransport = undefined
    await this.runtime?.close()
    this.runtime = undefined
  }
}
