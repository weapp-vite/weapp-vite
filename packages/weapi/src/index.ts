/// <reference types="miniprogram-api-typings" />
import { createWeapi } from './core/createWeapi'

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
} from './core/types'

/**
 * @description 默认跨平台 API 实例（推荐使用）
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 类型来源 | 支持度 |
 * | --- | --- | --- |
 * | 微信小程序 (`wx`) | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 (`my`) | `@mini-types/alipay` | ✅ 全量 |
 * | 其他平台对象 (`tt/swan/jd/xhs/...`) | 运行时对象透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export const wpi = createWeapi()

/**
 * @description 创建跨平台 API 实例
 */
export { createWeapi }
