import { writeFile } from 'node:fs/promises'

/** 仅在独立诊断中包装目标 binding 入口；计时 worker 直接加载原 addon，不改变编译器模块。 */
export async function createDiagnosticBinding(nativePath: string, file: string, fault: boolean) {
  await writeFile(file, `const binding = require(${JSON.stringify(nativePath)});
if (typeof binding.analyzeCompilerScriptsNative !== 'function') throw new Error('Missing compiler batch API');
let calls = 0, scripts = 0;
module.exports = { ...binding,
  analyzeCompilerScriptsNative(inputs) {
    calls++; scripts += inputs.length;
    ${fault ? 'throw new Error("Injected compiler batch failure");' : 'return binding.analyzeCompilerScriptsNative(inputs);'}
  },
  getCompilerBatchDiagnosticCounts() { return { calls, scripts }; }
};
`, { flag: 'wx', mode: 0o600 })
}
