import type {
  AlipayMiniProgramHostNamespace,
  DefaultMiniProgramHostNamespace,
  HostMiniProgramLaunchOptions,
  HostMiniProgramNavigateToOption,
  HostMiniProgramPageLifetime,
  HostMiniProgramRouter,
  MiniProgramHostNamespace,
  MiniProgramHostSourceName,
  MiniProgramLaunchOptions,
  MiniProgramNavigateToOption,
  MiniProgramRouter,
  TtMiniProgramHostNamespace,
  WechatMiniProgramHostNamespace,
} from '@/index'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<MiniProgramLaunchOptions>({} as HostMiniProgramLaunchOptions)
expectAssignable<HostMiniProgramLaunchOptions>({} as MiniProgramLaunchOptions)

expectAssignable<MiniProgramNavigateToOption>({} as HostMiniProgramNavigateToOption)
expectAssignable<HostMiniProgramNavigateToOption>({} as MiniProgramNavigateToOption)

expectAssignable<MiniProgramRouter>({} as HostMiniProgramRouter)
expectAssignable<HostMiniProgramRouter>({} as MiniProgramRouter)

expectType<DefaultMiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<DefaultMiniProgramHostNamespace.Page.ILifetime>({} as HostMiniProgramPageLifetime)
expectType<MiniProgramHostNamespace.Page.ILifetime>({} as HostMiniProgramPageLifetime)
expectType<MiniProgramHostSourceName>('default')
expectType<MiniProgramHostSourceName>('wechat')
expectType<MiniProgramHostSourceName>('alipay')
expectType<MiniProgramHostSourceName>('tt')
expectType<WechatMiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<AlipayMiniProgramHostNamespace>({} as AlipayMiniProgramHostNamespace)
expectType<TtMiniProgramHostNamespace>({} as TtMiniProgramHostNamespace)
