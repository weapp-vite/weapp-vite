import { isDeepStrictEqual } from 'node:util'

/** 每项结果保留预期值与实际值，区分规则偏离和无法完成的核验。 */
export function check(name, expected, actual) {
  return { name, expected, actual, status: isDeepStrictEqual(expected, actual) ? 'pass' : 'fail' }
}

export function incomplete(name, message) {
  return { name, expected: '完成核验', actual: message, status: 'error' }
}

export function exitCode(results) {
  return results.some(result => result.status === 'error') ? 2 : results.some(result => result.status === 'fail') ? 1 : 0
}

export function formatReport(results) {
  const display = value => value === undefined ? '<missing>' : JSON.stringify(value)
  return results.map(result => `[${result.status.toUpperCase()}] ${result.name}: expected=${display(result.expected)} actual=${display(result.actual)}`).join('\n')
}
