/* eslint-disable e18e/ban-dependencies -- 保留 execa 的跨平台 stdio tee 类型契约。 */
import type { Options } from 'execa'

function captureInheritedOutput(output: Options['stdout']): Options['stdout'] {
  if (output === 'inherit') {
    return ['pipe', 'inherit']
  }
  if (Array.isArray(output) && output.includes('inherit') && !output.includes('pipe') && !output.includes('overlapped')) {
    return ['pipe', ...output]
  }
  return output
}

/** 保留继承输出的终端目标，同时为就绪检测和错误诊断提供可读流。 */
export function captureDevProcessOutput(options: Options = {}): Options {
  if (options.stdio === 'inherit') {
    return { ...options, stdio: ['inherit', ['pipe', 'inherit'], ['pipe', 'inherit']] }
  }
  if (Array.isArray(options.stdio)) {
    return {
      ...options,
      stdio: [
        options.stdio[0],
        captureInheritedOutput(options.stdio[1]),
        captureInheritedOutput(options.stdio[2]),
        ...options.stdio.slice(3),
      ],
    }
  }
  if (options.stdio !== undefined) {
    return options
  }
  return {
    ...options,
    stdout: captureInheritedOutput(options.stdout),
    stderr: captureInheritedOutput(options.stderr),
  }
}
