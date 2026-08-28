import type {
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSystemInfo,
  WeapiResolvedTarget,
} from '@weapp-core/api'
import type { ApiMock } from '@weapp-core/api/vitest'
import {
  apiMock,
  createApiMock,
  createWpiMock,
  resetApiMock,
  setupApiMock,
  wpiMock,
} from '@weapp-core/api/vitest'
import { expectType } from 'tsd'

expectType<ApiMock>(apiMock)
expectType<ApiMock>(wpiMock)
expectType<typeof createApiMock>(createWpiMock)
expectType<void>(resetApiMock())
expectType<void>(setupApiMock(['@weapp-core/api']))

wpiMock.request.mockImplementation((options) => {
  expectType<WeapiMiniProgramRequestOption>(options)
  options.success?.({} as WeapiMiniProgramRequestSuccessResult)
  return {} as WeapiMiniProgramRequestTask
})
wpiMock.request.mockImplementation(async (options) => {
  expectType<string>(options.url)
  return {} as WeapiMiniProgramRequestSuccessResult
})
wpiMock.request.mockResolvedValue({} as WeapiMiniProgramRequestSuccessResult)
wpiMock.getSystemInfoSync.mockReturnValue({} as WeapiMiniProgramSystemInfo)
wpiMock.onMemoryWarning.mockImplementation((callback) => {
  callback({ level: 10 })
})
wpiMock.supports.mockReturnValue(true)
wpiMock.resolveTarget.mockImplementation((method) => {
  expectType<string>(method)
  return {} as WeapiResolvedTarget
})

interface CustomAdapter {
  readSync: (key: string) => number
}

const customMock = createApiMock<CustomAdapter>()
customMock.readSync.mockImplementation((key) => {
  expectType<string>(key)
  return 1
})
expectType<number>(customMock.readSync('key'))
