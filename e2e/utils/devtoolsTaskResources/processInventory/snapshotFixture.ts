interface FixtureInspection extends Promise<{ stdout: string, stderr: string, exitCode: number }> {
  pid: number
}

/** 旧门禁用例沿用相同逐帧调度；真实批量协议另由 source race 和 adapter 用例验证。 */
export function createSnapshotFixture(mocks: {
  ps: (...args: unknown[]) => FixtureInspection
  paths: (pids: number[], timeoutMs: number) => Promise<Map<number, string | null>>
}) {
  return async (deadline: number) => {
    function remaining() {
      const timeout = Math.floor(deadline - Date.now())
      if (timeout <= 0) {
        throw new Error('Resource sampling exhausted its shared process inspection budget.')
      }
      return timeout
    }
    const first = mocks.ps('/bin/ps', [], { timeout: remaining() })
    const initial = { ...await first, inspectorPid: first.pid }
    const pids = initial.stdout.trim().split(/\r?\n/).map(line => Number(line.trim().split(/\s+/)[0])).filter(pid => pid !== first.pid)
    const paths = await mocks.paths(pids, remaining())
    const second = mocks.ps('/bin/ps', [], { timeout: remaining() })
    return { initial, paths, after: { ...await second, inspectorPid: second.pid } }
  }
}
