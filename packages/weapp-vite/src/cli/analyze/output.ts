import process from 'node:process'

/** CLI 单次分析期间保留 JSON 专用写入入口，配置、插件和清理日志走 stderr。 */
export async function withAnalyzeOutput(json: boolean, run: (writeJson: (value: unknown) => void) => Promise<void>) {
  const stdoutWrite = process.stdout.write
  const writeJson = (value: unknown) => stdoutWrite.call(process.stdout, `${JSON.stringify(value, null, 2)}\n`)
  if (json) {
    process.stdout.write = process.stderr.write.bind(process.stderr)
  }
  try {
    await run(writeJson)
  }
  finally {
    process.stdout.write = stdoutWrite
  }
}
