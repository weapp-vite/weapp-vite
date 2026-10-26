import { createNativeHmrPublication } from './nativeHmrPublication'

type Issue1015HmrRuntime = 'classic' | 'stateful-experimental'

/** 外部样式回归复用实际发布解析器，限定该场景允许的能力交接原因。 */
export function createIssue1015HmrPublication(
  project: string,
  dev: Parameters<typeof createNativeHmrPublication>[1],
  runtime: Issue1015HmrRuntime,
  profilePath: string,
) {
  return createNativeHmrPublication(project, dev, runtime, ['ide-classic-handoff'], profilePath)
}

/** 身份比较始终针对首屏记录的 App/Page，区分首次观察与后续编辑。 */
export function issue1015ExpectedMarkerMatches(runtime: Issue1015HmrRuntime, checkpoint: string) {
  if (checkpoint === 'initial') {
    return { app: true, page: true }
  }
  if (runtime === 'stateful-experimental' || checkpoint === 'style-only') {
    return { app: false, page: false }
  }
}
