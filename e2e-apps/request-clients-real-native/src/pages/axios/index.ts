import axios from 'axios'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

Page({
  data: {
    baseUrl: '',
    state: createRequestCaseState(),
  },
  onLoad(query: Record<string, unknown>) {
    this.setData({
      baseUrl: resolveBaseUrl(query),
    })
    void this.runCase()
  },
  async runCase() {
    if (!this.data.baseUrl) {
      const snapshot = createErrorState(createRunningState(this.data.state), new Error('missing baseUrl'))
      this.setData({ state: snapshot })
      return snapshot
    }

    const nextState = createRunningState(this.data.state)
    this.setData({ state: nextState })

    try {
      const response = await axios.request({
        data: {
          client: 'axios',
          run: nextState.runCount,
        },
        headers: {
          'content-type': 'application/json',
        },
        method: 'post',
        url: `${this.data.baseUrl}/axios`,
      })
      const payload = response.data
      if (payload.transport !== 'axios' || (payload.query?.client !== 'axios' && payload.body?.client !== 'axios')) {
        throw new Error(`unexpected axios payload: ${JSON.stringify(payload)}`)
      }
      const snapshot = createSuccessState(nextState, response.status, payload)
      this.setData({ state: snapshot })
      return snapshot
    }
    catch (error) {
      const snapshot = createErrorState(nextState, error)
      this.setData({ state: snapshot })
      return snapshot
    }
  },
  async runE2E() {
    const snapshot = await this.runCase()
    return {
      baseUrl: this.data.baseUrl,
      ok: snapshot.pageStatus === '全部通过',
      snapshot,
    }
  },
})
