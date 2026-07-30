import type { HeadlessTestingPageHandle } from '@mpcore/simulator'
import type { MiniProgramNode, MiniProgramScreen } from './screen'

export class MiniProgramUser {
  constructor(
    private readonly page: HeadlessTestingPageHandle,
    private readonly screen: MiniProgramScreen,
    private readonly settle: () => Promise<void>,
  ) {}

  private async nodeHandle(node: MiniProgramNode) {
    const handle = await this.page.$(`[data-sim-node="${node.nodeId}"]`)
    if (!handle) {
      throw new Error('The mini-program node is no longer available for interaction.')
    }
    return handle
  }

  private async finish() {
    await this.settle()
    await this.screen.refresh()
  }

  async tap(node: MiniProgramNode, event: Record<string, any> = {}) {
    await (await this.nodeHandle(node)).tap(event)
    await this.finish()
  }

  async input(node: MiniProgramNode, value: string, event: Record<string, any> = {}) {
    await (await this.nodeHandle(node)).input(value, event)
    await this.finish()
  }

  async change(node: MiniProgramNode, value: string, event: Record<string, any> = {}) {
    await (await this.nodeHandle(node)).change(value, event)
    await this.finish()
  }

  async blur(node: MiniProgramNode, value?: string, event: Record<string, any> = {}) {
    await (await this.nodeHandle(node)).blur(value, event)
    await this.finish()
  }

  async trigger(node: MiniProgramNode, eventName: string, event: Record<string, any> = {}) {
    await (await this.nodeHandle(node)).trigger(eventName, event)
    await this.finish()
  }
}
