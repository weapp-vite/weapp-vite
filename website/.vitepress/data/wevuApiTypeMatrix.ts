import type { WevuApiSeed } from './wevuApiCatalogTypes'

const vueTypes = 'https://cn.vuejs.org/api/utility-types.html'

function typeSeed(
  name: string,
  anchor: string,
  description: string,
  compatibility: WevuApiSeed['compatibility'] = 'vue-compatible-with-notes',
): WevuApiSeed {
  return {
    name,
    description,
    href: `/wevu/api/types#${anchor}`,
    vueHref: `${vueTypes}#${anchor}`,
    group: 'TypeScript 类型',
    kind: 'type',
    phase: 'type',
    compatibility,
    keywords: ['TypeScript', '类型'],
  }
}

export const wevuTypeSeeds: WevuApiSeed[] = [
  typeSeed('PropType<T>', 'proptype', '声明运行时 props 构造器对应的 TypeScript 类型。'),
  typeSeed('MaybeRef<T>', 'mayberef', '表示普通值、Ref 或可写计算值。'),
  typeSeed('MaybeRefOrGetter<T>', 'maybereforgetter', '表示普通值、响应式值或 getter。'),
  typeSeed('ExtractPropTypes<T>', 'extractproptypes', '从 Wevu props 选项推导内部属性类型。'),
  typeSeed('ExtractPublicPropTypes<T>', 'extractpublicproptypes', '从 Wevu props 选项推导公开属性类型。'),
  typeSeed('ComponentCustomProps', 'componentcustomprops', '沿用 Vue 的组件自定义 props 扩展类型。', 'vue-compatible'),
  typeSeed('RuntimeApp', 'runtimeapp', '描述 Wevu 应用实例及其公开方法。', 'wevu-extension'),
  typeSeed('AppConfig', 'appconfig', '描述 Wevu 应用级配置与 globalProperties。', 'vue-different'),
  typeSeed('WevuPlugin', 'wevuplugin', '描述函数式或对象式 Wevu 插件。', 'vue-compatible-with-notes'),
]
