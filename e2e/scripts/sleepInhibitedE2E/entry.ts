export function selectSleepInhibitedE2EEntry(args: readonly string[]) {
  const name = args[0]
  return name === 'devtools-matrix' || name === 'hmr-acceptance'
    ? { name, args: args.slice(1) }
    : { name: 'suite' as const, args: [...args] }
}

/** 在当前进程调用正式 CLI，统一由 suite owner 等待资源收尾。 */
export async function runSleepInhibitedE2EEntry(args: readonly string[], signal: AbortSignal) {
  const entry = selectSleepInhibitedE2EEntry(args)
  if (entry.name === 'devtools-matrix') {
    const { runDevtoolsMatrixCli } = await import('../run-devtools-matrix')
    signal.throwIfAborted()
    return (await runDevtoolsMatrixCli(entry.args, { signal })).exitCode
  }
  if (entry.name === 'hmr-acceptance') {
    const { runHmrAcceptanceCli } = await import('../run-hmr-acceptance')
    signal.throwIfAborted()
    await runHmrAcceptanceCli(entry.args, { signal })
    return
  }
  const { runE2ESuiteCli } = await import('../run-e2e-suite')
  signal.throwIfAborted()
  return await runE2ESuiteCli(entry.args, { signal })
}
