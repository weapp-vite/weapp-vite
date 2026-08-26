import process from 'node:process'

interface ExecuteOptions {
  pipeStdout?: boolean
  pipeStderr?: boolean
  timeout?: number
}

/**
 * @description 执行 CLI 命令并透传输出
 */
export async function execute(cliPath: string, argv: string[], options: ExecuteOptions = {}) {
  const {
    pipeStdout = true,
    pipeStderr = true,
    timeout,
  } = options

  // eslint-disable-next-line e18e/ban-dependencies -- 微信 CLI 启动需要跨平台的流透传与超时控制
  const { execa } = await import('execa')
  const task = execa(cliPath, argv, {
    timeout,
  })

  if (pipeStdout) {
    task?.stdout?.pipe(process.stdout)
  }
  if (pipeStderr) {
    task?.stderr?.pipe(process.stderr)
  }

  return await task
}
