import assert from 'node:assert/strict'
import path from 'node:path'
import { assertChunk, assertLazyDescriptor, describeOptions, diagnosticGc, fixture, outputCode, runtimeResult, writtenOutput } from './helpers.mjs'

export async function hooks(rolldown, root) {
  const files = await fixture(root, 'hooks')
  const marker = Symbol('normalized-options-marker')
  const events = []
  const state = { generation: 0, gcPending: false, inputSnapshots: [], outputSnapshots: [], hookSnapshots: [] }
  const plugin = {
    name: 'snapshot-contract-hooks',
    buildStart(input) {
      state.generation++
      input[marker] = state.generation
      state.inputRef = new WeakRef(input)
      state.gcPending = true
      state.inputSnapshots.push({ input: input.input, cwd: input.cwd, platform: input.platform })
      events.push(`buildStart:${state.generation}`)
    },
    async transform(code) {
      if (state.gcPending) {
        state.gcPending = false
        await diagnosticGc()
      }
      return code
    },
    renderStart(output, input) {
      assert.equal(input, state.inputRef.deref())
      assert.equal(input[marker], state.generation)
      output[marker] = state.generation
      state.outputRef = new WeakRef(output)
      state.inputOnLog = input.onLog
      state.inputPlugins = input.plugins
      state.outputPlugins = output.plugins
      state.outputSnapshots.push({
        generation: state.generation,
        format: output.format,
        dir: output.dir,
        entryFileNames: output.entryFileNames,
        exports: output.exports,
        sourcemap: output.sourcemap,
      })
      assert.equal(output.format, state.generation === 1 || state.generation === 3 ? 'es' : 'cjs')
      events.push(`renderStart:${state.generation}`)
    },
    renderChunk(code, chunk, output) {
      assert.equal(output, state.outputRef.deref())
      assert.equal(output[marker], state.generation)
      assert.equal(output.plugins, state.outputPlugins)
      events.push(`renderChunk:${state.generation}`)
      return code
    },
    generateBundle(output) {
      assert.equal(output, state.outputRef.deref())
      assert.equal(output[marker], state.generation)
      assert.equal(output.format, state.outputSnapshots.at(-1).format)
      assert.equal(output.dir, state.outputSnapshots.at(-1).dir)
      state.hookSnapshots.push({ generation: state.generation, hook: 'generateBundle', format: output.format, dir: output.dir, entryFileNames: output.entryFileNames, exports: output.exports, sourcemap: output.sourcemap })
      events.push(`generateBundle:${state.generation}`)
    },
    writeBundle(output) {
      assert.equal(output, state.outputRef.deref())
      assert.equal(output.format, state.outputSnapshots.at(-1).format)
      assert.equal(output.dir, state.outputSnapshots.at(-1).dir)
      state.hookSnapshots.push({ generation: state.generation, hook: 'writeBundle', format: output.format, dir: output.dir, entryFileNames: output.entryFileNames, exports: output.exports, sourcemap: output.sourcemap })
      events.push(`writeBundle:${state.generation}`)
    },
    closeBundle() { events.push('closeBundle') },
  }
  const bundle = await rolldown({ input: files.entry, cwd: files.cwd, platform: 'neutral', plugins: [plugin], preserveEntrySignatures: 'strict' })
  const outputs = []
  try {
    for (const [index, method, format] of [[1, 'generate', 'es'], [2, 'write', 'cjs'], [3, 'generate', 'es']]) {
      const entryFileNames = `entry-${index}.${format === 'cjs' ? 'cjs' : 'mjs'}`
      const result = await bundle[method]({
        dir: path.join(files.cwd, `out-${index}`),
        format,
        entryFileNames,
        exports: 'named',
        sourcemap: false,
        banner: async () => {
          await diagnosticGc()
          return ''
        },
      })
      const chunk = assertChunk(result)
      const code = outputCode(result)
      const written = method === 'write' ? await writtenOutput(path.join(files.cwd, `out-${index}`), result) : []
      const runtimeValue = await runtimeResult(chunk.code, format, path.join(files.cwd, `out-${index}`, chunk.fileName))
      assert.equal(runtimeValue, 42)
      outputs.push({ method, format, runtimeValue, fileName: chunk.fileName, exports: chunk.exports, code: code.map(item => ({ fileName: item.fileName, bytes: item.bytes, sha256: item.sha256 })), written: written.map(item => ({ fileName: item.fileName, bytes: item.bytes, sha256: item.sha256 })) })
    }
  }
  finally { await bundle.close() }
  assert.equal(bundle.closed, true)
  assert.equal(state.generation, 3)
  assert.deepEqual(events, [
    'buildStart:1',
    'renderStart:1',
    'renderChunk:1',
    'generateBundle:1',
    'buildStart:2',
    'renderStart:2',
    'renderChunk:2',
    'generateBundle:2',
    'writeBundle:2',
    'buildStart:3',
    'renderStart:3',
    'renderChunk:3',
    'generateBundle:3',
    'closeBundle',
  ])
  assert.deepEqual(state.inputSnapshots, Array.from({ length: 3 }, () => ({ input: [files.entry], cwd: files.cwd, platform: 'neutral' })))
  assert.deepEqual(state.outputSnapshots.map(({ format, dir, entryFileNames }) => ({ format, dir, entryFileNames })), [
    { format: 'es', dir: path.join(files.cwd, 'out-1'), entryFileNames: 'entry-1.mjs' },
    { format: 'cjs', dir: path.join(files.cwd, 'out-2'), entryFileNames: 'entry-2.cjs' },
    { format: 'es', dir: path.join(files.cwd, 'out-3'), entryFileNames: 'entry-3.mjs' },
  ])
  assert.deepEqual(state.outputSnapshots.map(({ exports, sourcemap }) => ({ exports, sourcemap })), Array.from({ length: 3 }, () => ({ exports: 'named', sourcemap: false })))
  assert.deepEqual(state.hookSnapshots.map(({ hook, ...snapshot }) => snapshot), [state.outputSnapshots[0], state.outputSnapshots[1], state.outputSnapshots[1], state.outputSnapshots[2]])
  return { events, outputs, inputSnapshots: state.inputSnapshots, outputSnapshots: state.outputSnapshots, hookSnapshots: state.hookSnapshots }
}

export async function escaped(rolldown, root) {
  const files = await fixture(root, 'escaped')
  let savedInput
  let savedOutput
  let onLog
  let inputPlugins
  let outputPlugins
  const callbacks = {
    entryFileNames: () => 'entry.js',
    chunkFileNames: () => 'chunk.js',
    assetFileNames: () => 'asset.bin',
    sourcemapFileNames: () => 'entry.js.map',
    banner: () => '/* banner */',
    globals: id => id,
    paths: id => id,
    sourcemapPathTransform: source => source,
  }
  const plugin = {
    name: 'snapshot-contract-escaped',
    buildStart(input) {
      savedInput = input
      onLog = input.onLog
      inputPlugins = input.plugins
    },
    renderStart(output) {
      savedOutput = output
      outputPlugins = output.plugins
    },
  }
  const bundle = await rolldown({ input: { entry: files.entry }, cwd: files.cwd, platform: 'neutral', context: 'snapshotContext', checks: { bundlerTimings: false, pluginTimings: false }, preserveEntrySignatures: 'strict', plugins: [plugin] })
  try {
    assertChunk(await bundle.generate({
      ...callbacks,
      format: 'es',
      sourcemap: 'hidden',
      footer: '/* footer */',
      postBanner: '/* post banner */',
      postFooter: '/* post footer */',
      intro: '/* intro */',
      outro: '/* outro */',
      minify: { compress: false, mangle: false, mangleProps: { include: /^_private_/iu, exclude: /keep/u, reserved: ['stable'] } },
      comments: { legal: true, annotation: false, jsdoc: true },
    }))
  }
  finally { await bundle.close() }
  await diagnosticGc()
  assert.equal(savedInput.onLog, onLog)
  assert.equal(savedInput.plugins, inputPlugins)
  assert.equal(savedOutput.plugins, outputPlugins)
  assert.equal(savedInput.context, 'snapshotContext')
  assert.equal(savedInput.platform, 'neutral')
  assert.deepEqual(savedInput.input, { entry: files.entry })
  for (const [key, callback] of Object.entries(callbacks)) {
    assert.equal(savedOutput[key], callback, key)
  }
  for (const key of ['footer', 'postBanner', 'postFooter', 'intro', 'outro']) {
    assert.equal(typeof savedOutput[key], 'function')
  }
  assert.equal(await savedOutput.footer(), '/* footer */')
  assertLazyDescriptor(savedInput, 'input')
  assertLazyDescriptor(savedOutput, 'minify')
  const minify = savedOutput.minify
  assert.equal(minify, savedOutput.minify)
  assert.ok(minify.mangleProps.include instanceof RegExp)
  assert.equal(minify.mangleProps.include.source, '^_private_')
  assert.equal(minify.mangleProps.include.flags, 'iu')
  assert.ok(!('codegen' in minify) && !('module' in minify) && !('sourcemap' in minify))
  const input = savedInput.input
  input.additional = 'user-marker'
  assert.equal(savedInput.input, input)
  assert.equal(savedInput.input.additional, 'user-marker')
  const comments = savedOutput.comments
  comments.legal = false
  assert.equal(savedOutput.comments, comments)
  assert.equal(savedOutput.comments.legal, false)
  const observations = describeOptions(savedInput, savedOutput)
  assert.deepEqual(observations.input, {
    input: { entry: files.entry, additional: 'user-marker' },
    cwd: files.cwd,
    platform: 'neutral',
    shimMissingExports: false,
    context: 'snapshotContext',
    plugins: ['snapshot-contract-escaped'],
  })
  assert.deepEqual(observations.output, {
    dir: undefined,
    entryFileNames: '[function]',
    chunkFileNames: '[function]',
    assetFileNames: '[function]',
    format: 'es',
    exports: 'auto',
    sourcemap: 'hidden',
    sourcemapFileNames: '[function]',
    sourcemapBaseUrl: undefined,
    shimMissingExports: false,
    name: undefined,
    file: undefined,
    codeSplitting: true,
    inlineDynamicImports: false,
    dynamicImportInCjs: true,
    externalLiveBindings: true,
    banner: '[function]',
    footer: '[function]',
    postBanner: '[function]',
    postFooter: '[function]',
    intro: '[function]',
    outro: '[function]',
    esModule: 'if-default-prop',
    extend: false,
    globals: '[function]',
    paths: '[function]',
    hashCharacters: 'base64',
    sourcemapDebugIds: false,
    sourcemapExcludeSources: false,
    sourcemapIgnoreList: undefined,
    sourcemapPathTransform: '[function]',
    minify: {
      mangleProps: {
        include: { source: '^_private_', flags: 'iu', lastIndex: 0 },
        exclude: { source: 'keep', flags: 'u', lastIndex: 0 },
        reserved: ['stable'],
        quoted: false,
        debug: false,
        cache: {},
      },
    },
    legalComments: 'inline',
    comments: { legal: false, annotation: false, jsdoc: true },
    polyfillRequire: true,
    plugins: [],
    preserveModules: false,
    preserveModulesRoot: null,
    virtualDirname: '_virtual',
    topLevelVar: false,
    minifyInternalExports: true,
  })
  return observations
}
