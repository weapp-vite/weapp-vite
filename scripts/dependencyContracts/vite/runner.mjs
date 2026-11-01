import assert from 'node:assert/strict'

export const viteContractCases = Object.freeze(['hooks', 'resolver', 'optimizer', 'optimizer-cancel', 'optimizer-server', 'polling'])

/** 无参数仍执行完整门禁；显式筛选仅用于独立诊断。 */
export function parseViteContractCases(args) {
  const selected = []
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    const name = argument === '--case' ? args[++index] : argument.startsWith('--case=') ? argument.slice('--case='.length) : undefined
    assert.ok(name && viteContractCases.includes(name), `Unknown Vite contract case: ${name ?? argument}`)
    if (!selected.includes(name)) {
      selected.push(name)
    }
  }
  return selected.length ? selected : [...viteContractCases]
}

/** 逐组串行执行，首个失败原样抛出，不把未运行的契约计为成功。 */
export async function runViteContractCases(cases, contracts) {
  const checks = []
  for (const name of cases) {
    assert.ok(viteContractCases.includes(name), `Unknown Vite contract case: ${name}`)
    assert.equal(typeof contracts[name], 'function', `Missing Vite contract entry: ${name}`)
    checks.push(...await contracts[name]())
  }
  return checks
}
