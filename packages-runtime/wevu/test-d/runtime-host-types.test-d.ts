import type {
  HostMiniProgramLaunchOptions,
  HostMiniProgramNavigateToOption,
  HostMiniProgramPageLifetime,
  HostMiniProgramRouter,
  MiniProgramHostNamespace,
  MiniProgramLaunchOptions,
  MiniProgramNavigateToOption,
  MiniProgramRouter,
} from '@/index'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<MiniProgramLaunchOptions>({} as HostMiniProgramLaunchOptions)
expectAssignable<HostMiniProgramLaunchOptions>({} as MiniProgramLaunchOptions)

expectAssignable<MiniProgramNavigateToOption>({} as HostMiniProgramNavigateToOption)
expectAssignable<HostMiniProgramNavigateToOption>({} as MiniProgramNavigateToOption)

expectAssignable<MiniProgramRouter>({} as HostMiniProgramRouter)
expectAssignable<HostMiniProgramRouter>({} as MiniProgramRouter)

expectType<MiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespace.Page.ILifetime>({} as HostMiniProgramPageLifetime)
