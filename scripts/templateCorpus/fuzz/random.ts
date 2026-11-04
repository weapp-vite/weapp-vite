/** 每例独立派生随机流，增加前序样本不会改变已记录失败的复现。 */
export function randomFor(seed: number, caseIndex: number) {
  let state = (seed ^ Math.imul(caseIndex + 1, 0x9E3779B1)) >>> 0
  return (limit: number) => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) % limit
  }
}
