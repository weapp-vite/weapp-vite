type SetupRunner = {
  bivarianceHack: (...args: any[]) => any
}['bivarianceHack']

export function runSetupFunction(
  setup: SetupRunner | undefined,
  props: Record<string, any>,
  context: any,
): unknown
export function runSetupFunction(
  setup: ((props: Record<string, any>, ctx: any) => any) | ((ctx: any) => any) | undefined,
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
  if (setup.length >= 2) {
    const setupWithProps = setup as (props: Record<string, any>, ctx: any) => any
    return setupWithProps(props, finalContext)
  }
  const setupWithContext = setup as (ctx: any) => any
  return setupWithContext(finalContext)
}
