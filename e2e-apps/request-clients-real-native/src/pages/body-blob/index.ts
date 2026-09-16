import { resolveBaseUrl } from '../../shared/runtime'
import { runBodyBlobContracts } from './checks'

Page({
  data: {
    baseUrl: '',
    status: 'idle',
    results: [] as Array<{ id: string, status: string, error: string }>,
  },
  onLoad(query: Record<string, unknown>) {
    this.setData({ baseUrl: resolveBaseUrl(query) })
  },
  async runE2E() {
    this.setData({ status: 'running' })
    const results = await runBodyBlobContracts(this.data.baseUrl)
    const status = results.every(item => item.status === 'passed') ? 'passed' : 'failed'
    this.setData({ results, status })
    return { status, results }
  },
})
