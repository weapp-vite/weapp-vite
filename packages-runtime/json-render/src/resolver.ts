const componentPath = '@wevu/json-render-components/renderer/index'

/** 在消费项目中注册已经由 lib 模式编译的组件，不向 AppService 引入构建依赖。 */
export function JsonRendererResolver() {
  const components: Readonly<Record<string, string>> = Object.freeze({
    'json-renderer': componentPath,
    'json-render-node': componentPath,
  })
  return {
    components,
    resolve(name: string) {
      const from = components[name]
      if (!from) {
        return undefined
      }
      return { name, from, sourceType: 'native' as const, typeImport: false }
    },
  }
}
