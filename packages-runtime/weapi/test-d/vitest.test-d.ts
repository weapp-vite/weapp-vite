import type { ApiMock, createApiMock } from '@wevu/api/vitest'
import {
  apiMock,
  createWpiMock,
  wpiMock,
} from '@wevu/api/vitest'
import { expectType } from 'tsd'

expectType<ApiMock>(apiMock)
expectType<ApiMock>(wpiMock)
expectType<typeof createApiMock>(createWpiMock)
