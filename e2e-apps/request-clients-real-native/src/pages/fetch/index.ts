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
      const response = await fetch(`${this.data.baseUrl}/fetch`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client: 'fetch',
          run: nextState.runCount,
        }),
      })
      const payload = await response.json()
      if (payload.transport !== 'fetch' || payload.method !== 'POST') {
        throw new Error(`unexpected fetch payload: ${JSON.stringify(payload)}`)
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
