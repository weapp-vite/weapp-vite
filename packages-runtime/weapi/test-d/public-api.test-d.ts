import type { createWeapi, MiniProgramApiInstance, WeapiInstance } from '@wevu/api'
import { api, createApi, wpi } from '@wevu/api'
import { expectType } from 'tsd'

expectType<MiniProgramApiInstance>(api)
expectType<WeapiInstance>(wpi)
expectType<typeof createWeapi>(createApi)
