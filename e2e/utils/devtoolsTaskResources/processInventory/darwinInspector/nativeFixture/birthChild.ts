import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 仅持有本测试启动且通过管道握手的 child，不使用系统进程匹配。
import { execa } from 'execa'
import { darwinInspectorLines } from '../lines'

/** shell 的 exec 保持 PID，便于验证内核 birth 不随可执行映像切换。 */
export async function createBirthChild() {
  const program = 'process.stdout.write("after-exec:"+process.pid+"\\n");process.stdin.resume()'
  const shell = 'printf "before-exec:%s\\n" "$$"; IFS= read -r trigger || exit 0; exec "$1" -e "$2"'
  const child = execa('/bin/sh', ['-c', shell, 'birth-child', process.execPath, program], { reject: false, buffer: false, timeout: 15_000 })
  const owner = child.nodeChildProcess
  const terminal = Promise.resolve(child)
  const lines = darwinInspectorLines(owner.stdout, terminal)
  const close = async () => {
    owner.stdin?.end()
    if (owner.exitCode === null && owner.signalCode === null) {
      child.kill('SIGKILL')
    }
    await terminal
    lines.dispose()
  }
  try {
    if (!owner.pid || await lines.next(5_000) !== `before-exec:${owner.pid}`) {
      throw new Error('Controlled native birth child did not complete its initial identity handshake.')
    }
    return {
      pid: owner.pid,
      async exec() {
        const response = lines.next(5_000)
        owner.stdin!.write('\n')
        if (await response !== `after-exec:${owner.pid}`) {
          throw new Error('Controlled exec did not preserve its exact owned child PID.')
        }
      },
      close,
    }
  }
  catch (error) {
    await close()
    throw error
  }
}
