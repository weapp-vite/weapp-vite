import type {
  AlipayMiniProgramHostNamespace,
  AlipayMiniProgramHostSourceContract,
  DefaultMiniProgramHostNamespace,
  DefaultMiniProgramHostSourceContract,
  HostMiniProgramLaunchOptions,
  HostMiniProgramNavigateToOption,
  HostMiniProgramPageLifetime,
  HostMiniProgramRouter,
  MiniProgramHostNamespace,
  MiniProgramHostNamespaceBySource,
  MiniProgramHostSourceName,
  MiniProgramHostSourceRegistry,
  MiniProgramLaunchOptions,
  MiniProgramNavigateToOption,
  MiniProgramRouter,
  TtMiniProgramHostNamespace,
  TtMiniProgramHostSourceContract,
  WechatMiniProgramHostNamespace,
  WechatMiniProgramHostSourceContract,
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
expectType<MiniProgramHostNamespaceBySource<'default'>['NavigateToOption']>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespaceBySource<'wechat'>['NavigateToOption']>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespaceBySource<'alipay'>>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'tt'>>({} as TtMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['default']>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['wechat']>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['alipay']>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['tt']>({} as TtMiniProgramHostSourceContract)
expectType<WechatMiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<AlipayMiniProgramHostNamespace>({} as AlipayMiniProgramHostNamespace)
expectType<TtMiniProgramHostNamespace>({} as TtMiniProgramHostNamespace)
