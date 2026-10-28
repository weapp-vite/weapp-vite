import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { rolldown } from 'rolldown'

const packageRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '../..')

/** 仅比较当前产物的不同消费入口，所有运行时代码由 Rolldown 原生写出。 */
export async function measureStreamingBundles(options = {}) {
  const evidenceRoot = path.resolve(repositoryRoot, options.outputDirectory ?? '.tmp/streaming-bundle-size')
  const inputRoot = path.join(evidenceRoot, 'input')
  const outputRoot = path.join(evidenceRoot, 'output')
  await mkdir(inputRoot, { recursive: true })
  await mkdir(outputRoot, { recursive: true })

  const scenarios = [
    {
      id: 'native-request',
      label: 'wx.request baseline',
      source: `export function run(url, onMessage) {
    const task = wx.request({ url, success(result) { onMessage(result.data) } })
    return () => task.abort()
  }
  `,
    },
    {
      id: 'buffered-fetch',
      label: 'buffered fetch + text()',
      source: `import { fetch } from '@wevu/web-apis/fetch'
  export async function run(url, onMessage) {
    const response = await fetch(url)
    onMessage(await response.text())
  }
  `,
    },
    {
      id: 'streaming-fetch',
      label: 'streaming fetch + TextDecoderStream + eventsource-parser/stream',
      source: `import { TextDecoderStreamPolyfill } from './stream-globals.mjs'
  import { fetch } from '@wevu/web-apis/fetch'
  import { EventSourceParserStream } from 'eventsource-parser/stream'
  export async function run(url, onMessage) {
    const response = await fetch(url, { miniProgram: { enableChunked: true } })
    const reader = response.body.pipeThrough(new TextDecoderStreamPolyfill()).pipeThrough(new EventSourceParserStream()).getReader()
    try {
      while (true) {
        const item = await reader.read()
        if (item.done) break
        onMessage(item.value.data)
      }
    }
    finally {
      reader.releaseLock()
    }
  }
  `,
    },
    {
      id: 'eventsource',
      label: 'EventSource + onmessage + close()',
      source: `import { EventSource } from '@wevu/web-apis/eventsource'
  export function run(url, onMessage) {
    const source = new EventSource(url)
    source.onmessage = event => onMessage(event.data)
    return () => source.close()
  }
  `,
    },
  ]

  // 第三方 stream parser 在模块求值时继承全局 TransformStream，因此先绑定同一构造器族。
  await writeFile(path.join(inputRoot, 'stream-globals.mjs'), `import { TransformStream } from '@wevu/web-apis/streams'
  globalThis.TransformStream = TransformStream
  export { TextDecoderStreamPolyfill } from '@wevu/web-apis/streams'
  `)

  const rows = []
  for (const scenario of scenarios.filter(scenario => options.includeNativeBaseline || scenario.id !== 'native-request')) {
    const input = path.join(inputRoot, `${scenario.id}.mjs`)
    const directory = path.join(outputRoot, scenario.id)
    await writeFile(input, scenario.source)
    // 仅清理此脚本拥有的单个场景输出；bundle 字节由 Rolldown 原生 write 写出。
    await rm(directory, { force: true, recursive: true })
    const warnings = []
    const build = await rolldown({
      input,
      cwd: repositoryRoot,
      platform: 'browser',
      external: () => false,
      treeshake: true,
      onwarn(warning) {
        if (warning.code === 'UNRESOLVED_IMPORT') {
          throw new Error(warning.message)
        }
        warnings.push({ code: warning.code, message: warning.message })
      },
    })
    try {
      const result = await build.write({
        dir: directory,
        entryFileNames: 'index.js',
        chunkFileNames: 'chunk-[hash].js',
        format: 'cjs',
        exports: 'named',
        minify: true,
        sourcemap: false,
        codeSplitting: false,
      })
      const files = []
      const modules = new Set()
      for (const output of result.output) {
        if (output.type !== 'chunk' || !/\.(?:mjs|cjs|js)$/.test(output.fileName)) {
          continue
        }
        if (output.imports.length || output.dynamicImports.length) {
          throw new Error(`Unexpected nonbundled imports in ${scenario.id}: ${output.imports.join(', ')}`)
        }
        const bytes = await readFile(path.join(directory, output.fileName))
        files.push({
          file: path.relative(repositoryRoot, path.join(directory, output.fileName)).split(path.sep).join('/'),
          rawBytes: bytes.byteLength,
          gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })
        for (const module of output.moduleIds) {
          modules.add(path.relative(repositoryRoot, module).split(path.sep).join('/'))
        }
      }
      rows.push({
        id: scenario.id,
        label: scenario.label,
        rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
        gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
        files,
        modules: [...modules].sort(),
        warnings,
      })
    }
    finally {
      await build.close()
    }
  }

  const versionOf = async name => JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${name}/package.json`)), 'utf8')).version
  const report = {
    measuredAt: new Date().toISOString(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim(),
    source: 'Current built working tree; not an old/new release comparison.',
    versions: {
      node: process.version,
      rolldown: await versionOf('rolldown'),
      streams: await versionOf('web-streams-polyfill'),
      eventsourceParser: await versionOf('eventsource-parser'),
    },
    options: { platform: 'browser', format: 'cjs', minify: true, treeshake: true, external: false, sourcemap: false, gzipLevel: 9 },
    accounting: 'Sum of every emitted JS file; gzip calculated independently per emitted file and summed.',
    caveats: [
      'Direct public package subentries are used; the root global installer and app prelude are excluded.',
      'The streaming parser requires a TransformStream global binding; the measured entry includes this setup before parser evaluation.',
      ...(options.includeNativeBaseline ? ['The wx.request baseline excludes Web API adaptation and SSE decoding and is a native host-call reference only.'] : []),
      'All dependencies are bundled; native host globals such as wx are runtime capabilities rather than external modules.',
      'These are current-feature bundle alternatives, not measurements against the previous version or whole mini-program output.',
      'No network request or emitted bundle was executed while measuring.',
    ],
    rows,
  }
  await writeFile(path.join(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const table = ['| Entry | Raw bytes | Gzip bytes | JS files |', '| --- | ---: | ---: | ---: |', ...rows.map(row => `| ${row.label} | ${row.rawBytes} | ${row.gzipBytes} | ${row.files.length} |`)]
  const outputArgument = path.relative(repositoryRoot, evidenceRoot).split(path.sep).join('/')
  const reproductionArguments = ['packages-runtime/web-apis/scripts/measure-streaming-bundles.mjs', '--out-dir', outputArgument, ...(options.includeNativeBaseline ? ['--include-native'] : [])]
  const reproduction = /^[\w .:/-]+$/.test(outputArgument)
    ? `\`node ${reproductionArguments[0]} --out-dir "${outputArgument}"${options.includeNativeBaseline ? ' --include-native' : ''}\``
    : `Pass these Node arguments individually (JSON array):\n\n\`${JSON.stringify(reproductionArguments)}\``
  await writeFile(path.join(evidenceRoot, 'report.md'), `# Current SSE bundle alternatives\n\n${table.join('\n')}\n\n${report.caveats.map(caveat => `- ${caveat}`).join('\n')}\n\nReproduce from repository root after rebuilding changed packages:\n\n${reproduction}\n`)
  console.log(JSON.stringify({ versions: report.versions, rows: rows.map(({ id, rawBytes, gzipBytes, files }) => ({ id, rawBytes, gzipBytes, jsFiles: files.length })) }, null, 2))

  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--out-dir')
  const outputDirectory = outputIndex === -1 ? undefined : process.argv[outputIndex + 1]
  if (outputIndex !== -1 && (!outputDirectory || outputDirectory.startsWith('--'))) {
    throw new Error('--out-dir requires an output directory')
  }
  await measureStreamingBundles({ outputDirectory, includeNativeBaseline: process.argv.includes('--include-native') })
}
