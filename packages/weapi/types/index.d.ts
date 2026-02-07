/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />

// eslint-disable-next-line antfu/no-import-dist
import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
  WeapiPromisify,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
} from '../dist/index.d.mts'

export type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
  WeapiPromisify,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
}

export function createWeapi<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>(
  options?: CreateWeapiOptions<TAdapter>,
): WeapiInstance<TAdapter>

export type WeapiDefaultInstance = WeapiInstance<WeapiCrossPlatformRawAdapter>

/**
 * 默认跨平台 API 实例。
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 全局对象 | 类型来源 | 对齐状态 |
 * | --- | --- | --- | --- |
 * | 微信小程序 | `wx` | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 | `my` | `@mini-types/alipay` | ✅ 全量 |
 * | 其他平台（tt/swan/jd/xhs 等） | 运行时宿主对象 | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export const wpi: WeapiDefaultInstance
