type SetupRunner = {
  bivarianceHack: (props: Record<string, any>, ctx: any) => any
}['bivarianceHack']

/**
 * 执行 setup 函数并注入运行时上下文（框架内部使用）。
 * @internal
 */
export function runSetupFunction(
  setup: SetupRunner | undefined,
  props: Record<string, any>,
  context: any,
): unknown
export function runSetupFunction(
  setup: SetupRunner | undefined,
  props: Record<string, any>,
  context: any,
) {
  if (typeof setup !== 'function') {
    return undefined
  }
  const runtimeContext = context?.runtime ?? {
    methods: Object.create(null),
    state: {},
    proxy: {},
    watch: () => () => {},
    bindModel: () => {},
  }
  if (context) {
    context.runtime = runtimeContext
  }
  const finalContext = {
    ...(context ?? {}),
    runtime: runtimeContext,
  }
  return setup(props, finalContext)
}
