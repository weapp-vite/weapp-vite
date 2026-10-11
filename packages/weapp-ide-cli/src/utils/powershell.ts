/** 固定重定向 stdout 的 UTF-8 编码，避免默认代码页损坏进程路径和安装身份。 */
export function withPowerShellUtf8Output(script: string) {
  return `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); ${script}`
}
