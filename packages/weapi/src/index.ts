import { createWeapi } from './core/createWeapi'

export type { CreateWeapiOptions, WeapiAdapter, WeapiInstance } from './core/types'

/**
 * @description 默认跨平台 API 实例（推荐使用）
 */
export const wpi = createWeapi()

/**
 * @description 创建跨平台 API 实例
 */
export { createWeapi }
