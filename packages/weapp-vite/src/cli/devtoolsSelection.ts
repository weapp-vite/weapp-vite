const selectionOptionNames = new Set([
  '--cli-path',
  '--devtools-channel',
  '--devtools-version',
  '--require-official-latest',
])

/** 只筛选可能包含选版参数的调用；参数值和透传边界仍由 IDE CLI 的原解析器处理。 */
export async function withWechatDevtoolsSelectionArgs<T>(argv: readonly string[], runner: (args: string[]) => Promise<T>): Promise<T> {
  if (argv.some(token => selectionOptionNames.has(token.split('=', 1)[0]!))) {
    const { withWechatDevtoolsSelectionArgs } = await import('weapp-ide-cli')
    return withWechatDevtoolsSelectionArgs(argv, runner)
  }
  return runner([...argv])
}
