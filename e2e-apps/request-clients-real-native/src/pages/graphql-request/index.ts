import { request } from 'graphql-request'
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
      const payload = await request<{
        transport: {
          client: string
          operationName: string
          path: string
          requestCount: number
        }
      }>(
        `${this.data.baseUrl}/graphql`,
        `
          query TransportProbe($run: Int!) {
            transport(run: $run) {
              client
              path
              requestCount
              operationName
            }
          }
        `,
        {
          run: nextState.runCount,
        },
      )
      if (payload.transport.client !== 'graphql-request') {
        throw new Error(`unexpected graphql payload: ${JSON.stringify(payload)}`)
      }
      const snapshot = createSuccessState(nextState, 200, {
        ...payload.transport,
        path: payload.transport.path,
        requestCount: payload.transport.requestCount,
      })
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
