import type {
  AlipayMiniProgramHostSourceContract,
  DefaultMiniProgramHostNamespace,
  DefaultMiniProgramHostSourceContract,
  DouyinMiniProgramHostSourceContract,
  HostMiniProgramBehaviorIdentifier,
  HostMiniProgramComponentTrivialInstance,
  HostMiniProgramLaunchOptions,
  HostMiniProgramNavigateToOption,
  HostMiniProgramPageLifetime,
  HostMiniProgramRouter,
  HostMiniProgramSelectorQuery,
  MiniProgramHostNamespace,
  MiniProgramHostNamespaceBySource,
  MiniProgramHostSourceName,
  MiniProgramHostSourceRegistry,
  MiniProgramLaunchOptions,
  MiniProgramNavigateToOption,
  MiniProgramPlatformHostNamespaceBySource,
  MiniProgramPlatformHostSourceName,
  MiniProgramPlatformHostSourceRegistry,
  MiniProgramRouter,
  MiniProgramRuntimeHostNamespaceBySource,
  MiniProgramRuntimeHostSourceName,
  MiniProgramRuntimeHostSourceRegistry,
  TtMiniProgramHostSourceContract,
  WechatMiniProgramHostNamespace,
  WechatMiniProgramHostSourceContract,
} from 'wevu'
import { expectAssignable, expectType } from 'tsd'
import { useSelectorQuery } from 'wevu'

expectType<WechatMiniprogram.SelectorQuery | null>(useSelectorQuery()())
expectType<WechatMiniprogram.SelectorQuery>({} as HostMiniProgramSelectorQuery)
expectType<WechatMiniprogram.Component.TrivialInstance>({} as HostMiniProgramComponentTrivialInstance)
expectType<WechatMiniprogram.Behavior.Identifier>({} as HostMiniProgramBehaviorIdentifier)
expectType<typeof Behavior>({} as WechatMiniProgramHostNamespace.Behavior.Constructor)
expectType<typeof Component>({} as WechatMiniProgramHostNamespace.Component.Constructor)

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
expectType<'default' | 'wechat' | 'alipay' | 'douyin' | 'wx' | 'my' | 'tt'>({} as MiniProgramHostSourceName)
expectType<'default' | 'wechat' | 'alipay' | 'douyin'>({} as MiniProgramPlatformHostSourceName)
expectType<'wx' | 'my' | 'tt'>({} as MiniProgramRuntimeHostSourceName)
expectType<MiniProgramHostNamespaceBySource<'default'>['NavigateToOption']>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespaceBySource<'wechat'>['NavigateToOption']>({} as HostMiniProgramNavigateToOption)
expectType<MiniProgramHostNamespaceBySource<'douyin'>>({} as DouyinMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'wx'>>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'wx'>>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'my'>>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'alipay'>>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostNamespaceBySource<'tt'>>({} as TtMiniProgramHostSourceContract)
expectType<MiniProgramPlatformHostNamespaceBySource<'wechat'>>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramPlatformHostNamespaceBySource<'douyin'>>({} as DouyinMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostNamespaceBySource<'wx'>>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostNamespaceBySource<'wx'>>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostNamespaceBySource<'my'>>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostNamespaceBySource<'tt'>>({} as TtMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['default']>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['wechat']>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['alipay']>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['douyin']>({} as DouyinMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['wx']>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['wx']>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['my']>({} as AlipayMiniProgramHostSourceContract)
expectType<MiniProgramHostSourceRegistry['tt']>({} as TtMiniProgramHostSourceContract)
expectType<MiniProgramPlatformHostSourceRegistry['douyin']>({} as DouyinMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostSourceRegistry['wx']>({} as DefaultMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostSourceRegistry['wx']>({} as WechatMiniProgramHostSourceContract)
expectType<MiniProgramRuntimeHostSourceRegistry['my']>({} as AlipayMiniProgramHostSourceContract)
expectType<WechatMiniProgramHostNamespace.NavigateToOption>({} as HostMiniProgramNavigateToOption)
expectType<DouyinMiniProgramHostSourceContract>({} as TtMiniProgramHostSourceContract)
