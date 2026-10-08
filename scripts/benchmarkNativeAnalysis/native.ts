import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { sha256 } from './artifacts'

/** 先确认真实绑定及结果，再采集；缺失二进制不能静默退回 JS 后声称 native 通过。 */
export async function verifyNativeBinding(nativePath: string) {
  const require = createRequire(import.meta.url)
  const binding = require(nativePath) as Record<string, unknown>
  if (typeof binding.analyzeScriptNative !== 'function') {
    throw new TypeError('Native binding has no analyzeScriptNative entry')
  }
  const result = binding.analyzeScriptNative('const data = require(\'./probe\'); wx.request({})', undefined, undefined, 'probe.js') as Record<string, unknown>
  if (result.hasStaticRequireLiteral !== true || result.hasPlatformApiAccess !== true || !Array.isArray(result.featureFlags)) {
    throw new Error('Native binding failed the correctness probe')
  }
  const files = new Set([nativePath, ...(await readdir(path.dirname(nativePath))).filter(file => file.endsWith('.node')).map(file => path.join(path.dirname(nativePath), file))])
  const identity: Record<string, string> = {}
  for (const file of [...files].sort()) {
    identity[path.basename(file)] = sha256(await readFile(file))
  }
  return { identity, digest: sha256(JSON.stringify(identity)), probe: 'passed' as const }
}

/** native 相关环境逐项继承，只切换本次比较的开关与已核验绑定路径。 */
export function collectorEnvironment(side: 'off' | 'on', nativePath: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...inherited,
    WEAPP_VITE_NATIVE: side === 'on' ? '1' : '0',
    WEAPP_VITE_NATIVE_AST_PATH: nativePath,
  }
}

/** 计数包装器仅用于独立诊断构建，正式采样始终直接加载原生绑定。 */
export async function createDiagnosticBinding(nativePath: string, file: string, trace: string) {
  await writeFile(file, `const fs = require('node:fs');
const binding = require(${JSON.stringify(nativePath)});
let calls = 0, failures = 0, inputs = 0, inputBytes = 0;
module.exports = Object.fromEntries(Object.entries(binding).map(([name, value]) => [name, typeof value !== 'function' ? value : (...args) => {
  calls++; inputs += Array.isArray(args[0]) ? args[0].length : 1;
  inputBytes += Array.isArray(args[0]) ? args[0].reduce((sum, item) => sum + Buffer.byteLength(typeof item.code === 'string' ? item.code : ''), 0) : Buffer.byteLength(typeof args[0] === 'string' ? args[0] : '');
  try { const result = value(...args); if (result === undefined || result === null) failures++; return result; }
  catch (error) { failures++; throw error; }
}]));
process.on('exit', () => fs.appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ pid: process.pid, calls, failures, inputs, inputBytes }) + '\\n'));
`)
}

export async function readNativeTrace(file: string) {
  const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return ''
    }
    throw error
  })
  const seen = new Set<number>()
  let calls = 0
  let failures = 0
  let inputs = 0
  let inputBytes = 0
  for (const line of text.trim() ? text.trim().split(/\r?\n/) : []) {
    const row = JSON.parse(line) as Record<string, unknown>
    if (!['pid', 'calls', 'failures', 'inputs', 'inputBytes'].every(key => Number.isSafeInteger(row[key]) && Number(row[key]) >= 0) || seen.has(Number(row.pid))) {
      throw new Error('Invalid or duplicate native diagnostic process evidence')
    }
    seen.add(Number(row.pid))
    calls += Number(row.calls)
    failures += Number(row.failures)
    inputs += Number(row.inputs)
    inputBytes += Number(row.inputBytes)
  }
  return { calls, failures, inputs, inputBytes, processes: seen.size }
}
