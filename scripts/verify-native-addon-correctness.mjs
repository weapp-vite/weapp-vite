import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { writeJson } from './nativeAddonCorrectness/evidence.mjs'
import { runCorrectness } from './nativeAddonCorrectness/runner.mjs'

export { verifyNativeExports, verifyNativeReport } from './nativeAddonCorrectness/gate.mjs'

async function main() {
  const [mode, directory, ...extra] = process.argv.slice(2)
  if (!['plan', 'binding', 'run', 'report'].includes(mode) || !directory || extra.length) {
    throw new Error('Usage: node scripts/verify-native-addon-correctness.mjs <plan|binding|run|report> <evidence-directory>')
  }
  const outputDirectory = path.resolve(directory)
  try {
    await runCorrectness(mode, process.cwd(), outputDirectory)
  }
  catch (error) {
    if (mode !== 'report') {
      throw error
    }
    await writeJson(outputDirectory, 'summary.json', {
      status: 'failed',
      reason: 'Frozen plan, actual-addon preflight, fresh execution, or complete correctness report is missing or invalid',
    })
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
