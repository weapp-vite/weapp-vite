export type WeapiAdapter = Record<string, any>

export interface CreateWeapiOptions {
  /**
   * @description 手动指定平台适配器（优先级高于自动探测）
   */
  adapter?: WeapiAdapter
  /**
   * @description 手动指定平台名称
   */
  platform?: string
}

export interface WeapiInstance {
  /**
   * @description 当前平台标识
   */
  readonly platform?: string
  /**
   * @description 获取当前适配器实例
   */
  getAdapter: () => WeapiAdapter | undefined
  /**
   * @description 手动替换平台适配器
   */
  setAdapter: (adapter?: WeapiAdapter, platform?: string) => void
  /**
   * @description 获取原始平台对象
   */
  readonly raw?: WeapiAdapter
  [key: string]: any
}
