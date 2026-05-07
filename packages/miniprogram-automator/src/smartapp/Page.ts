/**
 * @file 百度智能小程序页面对象。
 */
import type CorePage from '../Page'

export default class SmartappPage {
  path: string
  query: Record<string, unknown>
  uri: string

  constructor(private readonly page: CorePage | null, path = '', query: Record<string, unknown> = {}) {
    this.path = page?.path || path
    this.query = page?.query || query
    const queryText = new URLSearchParams(this.query as Record<string, string>).toString()
    this.uri = queryText ? `${this.path}?${queryText}` : this.path
  }

  async data(path?: string) {
    return await this.page?.data(path)
  }

  async setData(data: Record<string, unknown>) {
    await this.page?.setData(data)
  }

  async callMethod(method: string, ...args: unknown[]) {
    return await this.page?.callMethod(method, ...args)
  }
}
