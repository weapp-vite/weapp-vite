import assert from 'node:assert/strict'
import path from 'node:path'
import { assertChunk, describeOptions, fixture, outputCode, runtimeResult, writtenOutput } from '../helpers.mjs'
import { withBundle } from './support.mjs'

function outputSnapshot(output, generation) {
  return {
    generation,
    format: output.format,
    charset: output.charset,
    dir: output.dir,
    entryFileNames: output.entryFileNames,
    exports: output.exports,
    sourcemap: output.sourcemap,
  }
}

async function optionFunctionValues(output) {
  const values = {}
  for (const [key, args] of Object.entries({
    entryFileNames: [],
    chunkFileNames: [],
    assetFileNames: [],
    sourcemapFileNames: [],
    banner: [],
    footer: [],
    postBanner: [],
    postFooter: [],
    intro: [],
    outro: [],
    globals: ['public-dependency'],
    paths: ['public-dependency'],
    sourcemapPathTransform: ['source.js', 'entry.js.map'],
  })) {
    assert.equal(typeof output[key], 'function', `Retained public ${key} must remain callable`)
    values[key] = await output[key](...args)
  }
  return values
}

export async function optionValues(rolldown, root) {
  const files = await fixture(root, 'product-options')
  let savedInput
  let savedOutput
  let duringBuild
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
  await withBundle(rolldown, {
    input: { entry: files.entry },
    cwd: files.cwd,
    platform: 'neutral',
    context: 'productContext',
    checks: { bundlerTimings: false, pluginTimings: false },
    preserveEntrySignatures: 'strict',
    plugins: [{
      name: 'product-contract-options',
      async renderStart(output, input) {
        savedInput = input
        savedOutput = output
        duringBuild = { ...describeOptions(input, output), callbackValues: await optionFunctionValues(output) }
      },
    }],
  }, async (bundle) => {
    const output = await bundle.generate({
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
    })
    assert.equal(await runtimeResult(assertChunk(output).code, 'es'), 42)
  })
  // 用户主动保存的 hook 参数在 native close 后仍须保持公开值与调用结果。
  const afterClose = { ...describeOptions(savedInput, savedOutput), callbackValues: await optionFunctionValues(savedOutput) }
  assert.deepEqual(afterClose, duringBuild, 'Retained public options and callback results must remain readable after close')
  const observations = { ...afterClose, footer: afterClose.callbackValues.footer }
  assert.deepEqual(observations.input, {
    input: { entry: files.entry },
    cwd: files.cwd,
    platform: 'neutral',
    shimMissingExports: false,
    context: 'productContext',
    plugins: ['product-contract-options'],
  })
  assert.equal(observations.footer, '/* footer */')
  assert.deepEqual(observations.output, {
    dir: undefined,
    charset: 'utf8',
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
    comments: { legal: true, annotation: false, jsdoc: true },
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

export async function generateWrite(rolldown, root) {
  const files = await fixture(root, 'product-generate-write')
  const events = []
  const inputSnapshots = []
  const outputSnapshots = []
  const hookSnapshots = []
  const outputs = []
  let generation = 0
  const plugin = {
    name: 'product-contract-generate-write',
    buildStart(input) {
      generation++
      inputSnapshots.push({ input: [...input.input], cwd: input.cwd, platform: input.platform })
      events.push(`buildStart:${generation}`)
    },
    renderStart(output) {
      outputSnapshots.push(outputSnapshot(output, generation))
      events.push(`renderStart:${generation}`)
    },
    renderChunk(code, chunk, output) {
      assert.deepEqual(outputSnapshot(output, generation), outputSnapshots.at(-1))
      events.push(`renderChunk:${generation}`)
      return code
    },
    generateBundle(output) {
      const snapshot = outputSnapshot(output, generation)
      assert.deepEqual(snapshot, outputSnapshots.at(-1))
      hookSnapshots.push({ hook: 'generateBundle', ...snapshot })
      events.push(`generateBundle:${generation}`)
    },
    writeBundle(output) {
      const snapshot = outputSnapshot(output, generation)
      assert.deepEqual(snapshot, outputSnapshots.at(-1))
      hookSnapshots.push({ hook: 'writeBundle', ...snapshot })
      events.push(`writeBundle:${generation}`)
    },
    closeBundle() { events.push('closeBundle') },
  }
  await withBundle(rolldown, { input: files.entry, cwd: files.cwd, platform: 'neutral', plugins: [plugin], preserveEntrySignatures: 'strict' }, async (bundle) => {
    for (const [index, method, format] of [[1, 'generate', 'es'], [2, 'write', 'cjs'], [3, 'generate', 'es']]) {
      const dir = path.join(files.cwd, `out-${index}`)
      const result = await bundle[method]({
        dir,
        format,
        ...(index < 3 ? { charset: index === 1 ? 'ascii' : 'utf8' } : {}),
        entryFileNames: `entry-${index}.${format === 'cjs' ? 'cjs' : 'mjs'}`,
        exports: 'named',
        sourcemap: false,
      })
      const chunk = assertChunk(result)
      const code = outputCode(result)
      const written = method === 'write' ? await writtenOutput(dir, result) : []
      const runtimeValue = await runtimeResult(chunk.code, format, path.join(dir, chunk.fileName))
      assert.equal(runtimeValue, 42)
      outputs.push({ method, format, runtimeValue, fileName: chunk.fileName, exports: [...chunk.exports], code: code.map(({ code, ...item }) => item), written: written.map(({ code, ...item }) => item) })
    }
  })
  assert.equal(generation, 3)
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
  assert.deepEqual(inputSnapshots, Array.from({ length: 3 }, () => ({ input: [files.entry], cwd: files.cwd, platform: 'neutral' })))
  assert.deepEqual(outputSnapshots, ['es', 'cjs', 'es'].map((format, index) => ({
    generation: index + 1,
    format,
    charset: index === 0 ? 'ascii' : 'utf8',
    dir: path.join(files.cwd, `out-${index + 1}`),
    entryFileNames: `entry-${index + 1}.${format === 'cjs' ? 'cjs' : 'mjs'}`,
    exports: 'named',
    sourcemap: false,
  })))
  assert.deepEqual(hookSnapshots.map(({ hook, ...snapshot }) => snapshot), [outputSnapshots[0], outputSnapshots[1], outputSnapshots[1], outputSnapshots[2]])
  return { events, outputs, inputSnapshots, outputSnapshots, hookSnapshots, optionValues: await optionValues(rolldown, root) }
}

export async function repeatBuild(rolldown, root) {
  const files = await fixture(root, 'product-repeat-build')
  const rounds = []
  for (let round = 1; round <= 3; round++) {
    const events = []
    const result = await withBundle(rolldown, {
      input: files.entry,
      cwd: files.cwd,
      preserveEntrySignatures: 'strict',
      plugins: [{
        name: 'product-contract-repeat-build',
        buildStart(input) {
          assert.deepEqual(input.input, [files.entry])
          assert.equal(input.cwd, files.cwd)
          events.push('buildStart')
        },
        renderStart(output) {
          assert.equal(output.format, 'es')
          events.push('renderStart')
        },
        closeBundle() { events.push('closeBundle') },
      }],
    }, async (bundle) => {
      const output = await bundle.generate({ format: 'es' })
      const value = await runtimeResult(assertChunk(output).code, 'es')
      assert.equal(value, 42)
      return { value, code: outputCode(output).map(({ code, ...item }) => item) }
    })
    assert.deepEqual(events, ['buildStart', 'renderStart', 'closeBundle'])
    rounds.push({ round, events, ...result })
  }
  return { rounds }
}
