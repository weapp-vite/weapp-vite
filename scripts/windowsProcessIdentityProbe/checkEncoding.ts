import assert from 'node:assert/strict'
// eslint-disable-next-line e18e/ban-dependencies -- 用同一子进程边界最小化真实 Windows 输出编码。
import { execa } from 'execa'
import { withPowerShellUtf8Output } from '../../packages/weapp-ide-cli/src/utils/powershell'

/** 仅比较合成字符串，不读取进程或授予所有权；默认输出首错原样保留。 */
export async function checkWindowsQueryEncoding() {
  const expected = '节点'
  const script = '([string]::new([char[]]@(0x8282,0x70b9))) | ConvertTo-Json -Compress'
  const baseline = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10_000, stdin: 'ignore', windowsHide: true })
  const utf8 = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', withPowerShellUtf8Output(script)], { timeout: 10_000, stdin: 'ignore', windowsHide: true })
  const baselineValue: unknown = JSON.parse(baseline.stdout)
  const utf8Value: unknown = JSON.parse(utf8.stdout)
  console.info(JSON.stringify({
    stage: 'synthetic-json-encoding-comparison',
    baselineExact: baselineValue === expected,
    utf8Exact: utf8Value === expected,
    baselineQuestionMarks: baselineValue === '??',
    baselineLength: typeof baselineValue === 'string' ? baselineValue.length : null,
    utf8Length: typeof utf8Value === 'string' ? utf8Value.length : null,
  }))
  assert.equal(utf8Value, expected)
}
