export function compute(n = 10000): number {
  // 简单求和，模拟较重逻辑
  let sum = 0
  for (let i = 1; i <= n; i++) {
    sum += Math.sqrt(i)
  }
  return Math.round(sum)
}

