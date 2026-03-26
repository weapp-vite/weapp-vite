import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessSession } from '../runtime'
import { HeadlessTestingPageHandle } from './pageHandle'

export class HeadlessTestingSessionHandle {
  constructor(
    private readonly project: HeadlessProjectDescriptor,
    private readonly session: HeadlessSession,
  ) {}

  async close() {
    return
  }

  async currentPage() {
    const pages = this.session.getCurrentPages()
    const current = pages.at(-1)
    return current ? new HeadlessTestingPageHandle(this.project, current) : null
  }

  async getCurrentPages() {
    return this.session.getCurrentPages().map(page => new HeadlessTestingPageHandle(this.project, page))
  }

  async reLaunch(route: string) {
    const page = this.session.reLaunch(route)
    return new HeadlessTestingPageHandle(this.project, page)
  }

  async pageScrollTo(scrollTop: number) {
    this.session.pageScrollTo({ scrollTop })
  }

  async triggerPullDownRefresh() {
    this.session.triggerPullDownRefresh()
  }

  async triggerReachBottom() {
    this.session.triggerReachBottom()
  }

  async triggerResize(options: Record<string, any>) {
    this.session.triggerResize(options)
  }

  async triggerRouteDone(options?: Record<string, any>) {
    this.session.triggerRouteDone(options)
  }
}
