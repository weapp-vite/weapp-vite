/** 编译期可证明的静态原语；显式 undefined 与属性缺失分别保留。 */
export type ComponentStylePrimitive = string | boolean | number | null | undefined

/** 小程序组件样式选项的静态解析状态。 */
export type StaticComponentStyleOption
  = | { kind: 'absent' }
    | { kind: 'unknown' }
    | { kind: 'known', value: ComponentStylePrimitive }

/** Component 注册 options 的静态样式信息；定义过滤器等可能修改宿主配置时不产出此元数据。 */
export interface ComponentStyleOptions {
  styleIsolation: StaticComponentStyleOption
  addGlobalClass: StaticComponentStyleOption
}
