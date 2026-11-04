/** 按 UTF-16 片段缩减，只有仍满足原失败谓词时才保留候选。 */
export function minimizeFailure(source: string, fails: (candidate: string) => boolean, maximumChecks = 128) {
  let result = source
  let checks = 0
  let divisions = 2
  while (result.length > 1 && checks < maximumChecks) {
    const width = Math.ceil(result.length / divisions)
    let reduced = false
    for (let start = 0; start < result.length && checks < maximumChecks; start += width) {
      const candidate = result.slice(0, start) + result.slice(start + width)
      checks++
      if (candidate && fails(candidate)) {
        result = candidate
        divisions = Math.max(2, divisions - 1)
        reduced = true
        break
      }
    }
    if (!reduced) {
      if (divisions >= result.length) {
        break
      }
      divisions = Math.min(result.length, divisions * 2)
    }
  }
  return { source: result, checks }
}
