import type { Buffer } from 'node:buffer'
import { SELF_IDENTITY_WIRE } from './wire'

const marker = `${SELF_IDENTITY_WIRE}:phase:`
const statements = new Map([
  ['$writerFirst=[System.Diagnostics.Process]', 'lookup-before'],
  ['$writerBefore=$writerFirst.StartTime', 'start-before'],
  ['$writerExecutable=$writerFirst.MainModule', 'module-path'],
  ['$writerSecond=[System.Diagnostics.Process]', 'lookup-after'],
  ['$writerAfter=$writerSecond.StartTime', 'start-after'],
  ['if ($writerFirst.Id', 'generation-check'],
  ['if ($writerFirst.HasExited', 'exit-check'],
  ['$writerLegacyTicks=', 'serialize'],
  ['[Console]::Out.Flush()', 'stdout-flush'],
  ['$writerExitCode=1', 'error'],
  ['if ($null -ne $writerSecond)', 'dispose-after'],
  ['if ($null -ne $writerFirst)', 'dispose-before'],
  ['exit $writerExitCode', 'complete'],
])
const phases = ['entry', ...statements.values()]
const phasePattern = new RegExp(`^${marker}(${phases.join('|')})$`)
const phaseLines = new RegExp(`^${marker}(?:${phases.join('|')})\\r?\\n`, 'gm')

function phaseStatement(phase: string) {
  return `[Console]::Error.WriteLine('${marker}${phase}'); [Console]::Error.Flush()`
}

/** 仅增加已知阶段标记；移除标记后必须与原身份查询逐字相同。 */
export function traceWindowsSelfIdentityCommand(command: string) {
  return `${phaseStatement('entry')}\n${command.split('\n').flatMap((line) => {
    const phase = [...statements].find(([statement]) => line.trimStart().startsWith(statement))?.[1]
    return phase ? [phaseStatement(phase), line] : [line]
  }).join('\n')}`
}

/** 只接收固定 ASCII 阶段名；未知 stderr 不进入诊断日志。 */
export function observeWindowsSelfIdentityPhases(report: (phase: string) => void) {
  let buffered = ''
  return (chunk: Buffer | string) => {
    buffered += chunk.toString()
    const lines = buffered.split('\n')
    buffered = lines.pop()!
    for (const line of lines) {
      const phase = phasePattern.exec(line.replace(/\r$/, ''))?.[1]
      if (phase) {
        report(phase)
      }
    }
  }
}

/** 只有显式诊断调用可剥离完整已知标记；其余 stderr 继续触发失败。 */
export function stripWindowsSelfIdentityPhases(stderr: string) {
  return stderr.replace(phaseLines, '')
}
