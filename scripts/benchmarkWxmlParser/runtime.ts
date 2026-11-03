export const STACK_SIZE_KB = 4096
export const NODE_STACK_ARGUMENT = `--stack-size=${STACK_SIZE_KB}`
export const CHROMIUM_ARGUMENTS = ['--enable-automation', `--js-flags=${NODE_STACK_ARGUMENT}`]

export function assertNodeStackBudget(execArgv: readonly string[]) {
  const values = execArgv.flatMap((argument, index) => {
    const match = /^--stack[-_]size(?:=(.*))?$/.exec(argument)
    return match ? [match[1] ?? execArgv[index + 1]] : []
  })
  if (!values.length || values.some(value => value !== String(STACK_SIZE_KB))) {
    throw new Error(`Benchmark requires an explicit ${NODE_STACK_ARGUMENT} V8 stack budget for both arms.`)
  }
}
