import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { captureLocalSample } from './capture.mjs'
import { collectCiEvidence } from './ci.mjs'
import { prepareCiBenchmark } from './ci/prepare.mjs'
import { compareSamples } from './compare.mjs'
import { captureVerificationSample } from './localCapture.mjs'
import { captureRuntimeSample } from './runtimeCapture.mjs'

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { output: { type: 'string' }, config: { type: 'string' }, repository: { type: 'string' }, run: { type: 'string' } },
  })
  if (positionals[0] === 'capture') {
    if (!values.config || !values.output || positionals.length !== 1) {
      throw new Error('capture requires --config <JSON> and --output <sample.json>')
    }
    const config = JSON.parse(await readFile(values.config, 'utf8'))
    const sample = await captureLocalSample(config, values.output)
    return sample.outcome === 'passed' ? 0 : 1
  }
  if (positionals[0] === 'local') {
    if (!values.config || !values.output || positionals.length !== 1) {
      throw new Error('local requires --config <JSON> and --output <sample.json>')
    }
    const config = JSON.parse(await readFile(values.config, 'utf8'))
    const sample = await captureVerificationSample(config, values.output)
    return sample.outcome === 'passed' ? 0 : 1
  }
  if (positionals[0] === 'runtime') {
    if (!values.config || !values.output || positionals.length !== 1) {
      throw new Error('runtime requires --config <JSON> and --output <sample.json>')
    }
    const config = JSON.parse(await readFile(values.config, 'utf8'))
    const sample = await captureRuntimeSample(config, values.output)
    return sample.outcome === 'passed' ? 0 : 1
  }
  if (positionals[0] === 'ci') {
    if (!values.repository || !values.run || !values.config || !values.output || positionals.length !== 1) {
      throw new Error('ci requires --repository OWNER/REPO --run ID --config <topology.json> --output <evidence.json>')
    }
    const configuration = JSON.parse(await readFile(values.config, 'utf8'))
    const result = await collectCiEvidence(values.repository, values.run, configuration)
    await writeFile(values.output, `${JSON.stringify(result.sample ?? result, null, 2)}\n`)
    return 0
  }
  if (positionals[0] === 'prepare') {
    if (!values.repository || !values.run || !values.config || !values.output || positionals.length !== 1) {
      throw new Error('prepare requires --repository OWNER/REPO --run ID --config <policy.json> --output <draft.json>')
    }
    const configuration = JSON.parse(await readFile(values.config, 'utf8'))
    const preparation = await prepareCiBenchmark(values.repository, values.run, configuration)
    await writeFile(values.output, `${JSON.stringify(preparation, null, 2)}\n`)
    return 0
  }
  if (positionals.length < 6) {
    throw new Error('Supply at least three baseline and three candidate sample JSON files')
  }
  const samples = await Promise.all(positionals.map(async filename => JSON.parse(await readFile(filename, 'utf8'))))
  const report = compareSamples(samples)
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (values.output) {
    await writeFile(values.output, json)
  }
  process.stdout.write(json)
  return report.meetsTarget ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(code => process.exitCode = code).catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
