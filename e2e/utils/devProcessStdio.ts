/* eslint-disable e18e/ban-dependencies -- 保留 execa 的跨平台 stdio tee 类型契约。 */
import type { Options } from 'execa'

type TextOptions = Extract<Options, { encoding?: 'utf8' | 'utf16le' }>
type BinaryOptions = Exclude<Options, TextOptions>

function isStdioArray<T>(value: T): value is Extract<T, readonly unknown[]> {
  return Array.isArray(value)
}

function isTextOptions(options: Options): options is TextOptions {
  return options.encoding === undefined || options.encoding === 'utf8' || options.encoding === 'utf16le'
}

function captureInheritedOutput(output: TextOptions['stdout']): TextOptions['stdout']
function captureInheritedOutput(output: BinaryOptions['stdout']): BinaryOptions['stdout']
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
export function captureDevProcessOutput(options: BinaryOptions): BinaryOptions
export function captureDevProcessOutput(options?: TextOptions): TextOptions
export function captureDevProcessOutput(options?: Options): Options
export function captureDevProcessOutput(options: Options = {}): Options {
  if (options.stdio === 'inherit') {
    return { ...options, stdio: ['inherit', ['pipe', 'inherit'], ['pipe', 'inherit']] }
  }
  // encoding 同时约束 transform 的 chunk 类型；在各自分支中组合配置，保留联合类型的相关性。
  if (isTextOptions(options)) {
    if (isStdioArray(options.stdio)) {
      const [stdin, stdout, stderr, ...extra] = options.stdio
      return {
        ...options,
        stdio: [stdin, captureInheritedOutput(stdout), captureInheritedOutput(stderr), ...extra],
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
  if (isStdioArray(options.stdio)) {
    const [stdin, stdout, stderr, ...extra] = options.stdio
    return {
      ...options,
      stdio: [stdin, captureInheritedOutput(stdout), captureInheritedOutput(stderr), ...extra],
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
