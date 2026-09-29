import type { StatefulHmrOutputFile } from './outputWriter'

/** 脚本热更新会重建原生组件；保留旧样式直到脚本确认执行，再提交本批次样式。 */
export function retainStylesUntilScriptApplied(
  previous: Iterable<StatefulHmrOutputFile>,
  next: StatefulHmrOutputFile[],
  styleExtension: string,
): StatefulHmrOutputFile[] {
  const isStyle = (file: StatefulHmrOutputFile) => file.fileName.endsWith(`.${styleExtension}`)
  return [...next.filter(file => !isStyle(file)), ...Array.from(previous).filter(isStyle)]
}
