import type {
  AlipayMiniProgramHostNamespace,
  AlipayMiniProgramHostSourceContract,
  DefaultMiniProgramHostNamespace,
  DefaultMiniProgramHostSourceContract,
  DouyinMiniProgramHostNamespace,
  DouyinMiniProgramHostSourceContract,
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
  MiniProgramPlatformHostNamespaceBySource,
  MiniProgramPlatformHostSourceName,
  MiniProgramPlatformHostSourceRegistry,
  MiniProgramRouter,
  MiniProgramRuntimeHostNamespaceBySource,
  MiniProgramRuntimeHostSourceName,
  MiniProgramRuntimeHostSourceRegistry,
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
expectType<MiniProgramHostSourceName>('douyin')
expectType<MiniProgramHostSourceName>('wx')
expectType<MiniProgramHostSourceName>('my')
expectType<MiniProgramHostSourceName>('tt')
expectType<MiniProgramPlatformHostSourceName>('default')
expectType<MiniProgramPlatformHostSourceName>('wechat')
expectType<MiniProgramPlatformHostSourceName>('alipay')
expectType<MiniProgramPlatformHostSourceName>('douyin')
expectType<MiniProgramRuntimeHostSourceName>('wx')
expectType<MiniProgramRuntimeHostSourceName>('my')
expectType<MiniProgramRuntimeHostSourceName>('tt')
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
expectType<AlipayMiniProgramHostNamespace>({} as AlipayMiniProgramHostNamespace)
expectType<DouyinMiniProgramHostNamespace>({} as DouyinMiniProgramHostNamespace)
expectType<DouyinMiniProgramHostSourceContract>({} as TtMiniProgramHostSourceContract)
expectType<TtMiniProgramHostNamespace>({} as TtMiniProgramHostNamespace)
