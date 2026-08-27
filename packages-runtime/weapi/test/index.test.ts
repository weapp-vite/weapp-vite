import { api, createApi, createWeapi, wpi } from '../src'

describe('@wevu/api compatibility entry', () => {
  it('re-exports the framework-agnostic API implementation', () => {
    expect(api).toBe(wpi)
    expect(createApi).toBe(createWeapi)
  })
})
