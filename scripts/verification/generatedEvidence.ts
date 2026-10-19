const GENERATED_ACCEPTANCE_EVIDENCE_PREFIX = 'docs/reports/dom-acceptance/'
const GENERATED_SUITE_REPORT_FILE = /^docs\/reports\/\d{4}-\d{2}-\d{2}-\d{6}-[\w.](?:[\w.-]*[\w.])?-suite-report\/index\.(?:md|json)$/

/** 只排除未跟踪的生成证据；已跟踪改动和其他文件始终保留。 */
export function hasVerificationSourceChanges(trackedStatus: string, untrackedFiles: string): boolean {
  return Boolean(trackedStatus) || untrackedFiles.split('\0')
    .some(file => file && !file.startsWith(GENERATED_ACCEPTANCE_EVIDENCE_PREFIX) && !GENERATED_SUITE_REPORT_FILE.test(file))
}
