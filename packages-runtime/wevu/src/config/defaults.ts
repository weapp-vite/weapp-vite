import type { SetDataSnapshotOptions } from '../runtime/types/setData'
import type { PageFeatures } from './pageFeatures'

/** 编译期默认值允许的 JSON 数据；对象的可选字段可省略。 */
export type WevuConfigValue = string | number | boolean | null | WevuConfigValue[] | WevuConfigRecord

export interface WevuConfigRecord {
  [key: string]: WevuConfigValue | undefined
}

/** 编译配置不会保留回调；运行时 setWevuDefaults 仍接受完整选项。 */
export type WevuConfigSetDataOptions = Omit<SetDataSnapshotOptions, 'debug'> & { debug?: never }

/** 可写入编译产物的组件静态选项，不包含 RegExp 纯数据匹配器。 */
export interface WevuConfigComponentOptions {
  multipleSlots?: boolean
  addGlobalClass?: boolean
  styleIsolation?: 'isolated' | 'apply-shared' | 'shared' | 'page-isolated' | 'page-apply-shared' | 'page-shared'
  virtualHost?: boolean
  pureDataPattern?: never
}

export interface WevuConfigAppDefaults {
  data?: WevuConfigRecord
  globalData?: WevuConfigRecord
  setData?: WevuConfigSetDataOptions
  [key: string]: WevuConfigValue | undefined
}

export interface WevuConfigComponentDefaults {
  data?: WevuConfigRecord
  setData?: WevuConfigSetDataOptions
  features?: { [Key in keyof PageFeatures]: PageFeatures[Key] }
  allowNullPropInput?: boolean
  allowFunctionProps?: boolean | 'auto'
  setupLifecycle?: 'created' | 'attached'
  externalClasses?: string[]
  behaviors?: string[]
  options?: { [Key in keyof WevuConfigComponentOptions]: WevuConfigComponentOptions[Key] }
  [key: string]: WevuConfigValue | undefined
}

/** 仅供构建配置使用的 JSON 默认值；运行时 WevuDefaults 的 API 保持独立。 */
export interface WevuConfigDefaults {
  app?: WevuConfigAppDefaults
  component?: WevuConfigComponentDefaults
}
