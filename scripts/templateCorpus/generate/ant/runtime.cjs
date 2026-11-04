const assert = require('node:assert/strict')
const { Buffer } = require('node:buffer')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const process = require('node:process')

const roots = ['src', 'copilot', 'demo', 'copilot-demo']
const allowedConditions = new Set(['ALIPAY', 'WECHAT', 'ALIPAY || WECHAT'])
const ifdefOptions = {
  insertBlanks: false,
  extname: ['axml', 'ts', 'js', 'sjs', 'acss', 'less', 'tsx', 'json', 'json5', 'md'],
}

function hash(source) {
  return createHash('sha256').update(source).digest('hex')
}

function identity(file, bytes) {
  return { file, sha256: hash(bytes), bytes: Buffer.byteLength(bytes) }
}

// 官方 ifdef 内部使用 new Function；预先逐行限制为冻结来源实际使用的三种条件。
function validateConditions(source) {
  const conditions = []
  for (const line of source.split('\n')) {
    if (/^\s*(?:\/\/\/|\{\/\*|<!--)\s*#if/.test(line)) {
      const prefix = /^\s*<!--\s*#if\s/.exec(line)
      const expression = prefix ? line.slice(prefix[0].length).trimEnd() : ''
      const condition = expression.endsWith('-->') ? expression.slice(0, -3).trim() : ''
      assert.ok(prefix && allowedConditions.has(condition), 'Unapproved upstream conditional expression')
      conditions.push(condition)
    }
  }
  return conditions
}

function supportsWechat(markdown) {
  const match = /supportPlatform:\s*\[(.*?)\]/s.exec(markdown)
  return !match || match[1].split(',').map(item => item.trim().replace(/['"]/g, '')).includes('wechat')
}

async function listFiles(directory, prefix = '') {
  const files = []
  for (const entry of (await fs.readdir(path.join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    assert.ok(!entry.isSymbolicLink(), 'Ant input cannot contain symlinks')
    const file = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, file))
    }
    else {
      assert.ok(entry.isFile(), 'Unsupported Ant input entry')
      files.push(file)
    }
  }
  return files
}

async function optionalText(file) {
  try {
    return await fs.readFile(file, 'utf8')
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return ''
  }
}

async function wechatAllowList(input, files) {
  const names = new Set()
  for (const root of ['src', 'copilot']) {
    const directories = [...new Set(files.filter(file => file.startsWith(`${root}/`)).map(file => file.split('/')[1]))].sort()
    for (const directory of directories) {
      if (!directory.startsWith('.') && supportsWechat(await optionalText(path.join(input, root, directory, 'index.md')))) {
        names.add(directory)
      }
    }
  }
  return [...names].sort()
}

function selectTemplate(file, target, allowList) {
  const [root, component] = file.split('/')
  if (!roots.includes(root) || !file.endsWith('.axml')) {
    return 'outside-official-axml-task'
  }
  if (file.split('/').includes('__tests__')) {
    return 'official-test-exclusion'
  }
  if (target === 'weapp' && ['src', 'copilot'].includes(root) && !allowList.includes(component)) {
    return 'official-wechat-component-allowlist'
  }
}

async function preprocess(source, file, definitions, ifdef, Vinyl) {
  validateConditions(source)
  return new Promise((resolve, reject) => {
    const stream = ifdef(definitions, ifdefOptions)
    const results = []
    stream.on('data', result => results.push(result.contents))
    stream.once('error', reject)
    stream.once('end', () => {
      if (results.length !== 1) {
        reject(new Error('Official preprocessor must return exactly one file'))
      }
      else {
        resolve(results[0].toString('utf8'))
      }
    })
    stream.end(new Vinyl({ cwd: process.cwd(), base: path.resolve('src'), path: path.resolve('src', file), contents: Buffer.from(source) }))
  })
}

async function writeOutput(output, file, source) {
  await fs.mkdir(path.dirname(path.join(output, file)), { recursive: true })
  await fs.writeFile(path.join(output, file), source)
  return identity(file, source)
}

async function main(mode, target, output, providers, project = process.cwd()) {
  assert.ok(['development', 'production'].includes(mode), 'Unknown generation mode')
  assert.ok(['alipay', 'weapp'].includes(target), 'Unknown Ant Design Mini target')
  assert.ok(output && !path.isAbsolute(output) && !output.includes('\\') && !output.split('/').includes('..'), 'Unsafe Ant output path')
  const input = path.join(project, 'src')
  output = path.join(project, output)
  const files = await listFiles(input)
  const configuration = JSON.parse(await fs.readFile(path.join(project, 'ant-pipeline.json'), 'utf8'))
  const mappingBytes = await fs.readFile(path.join(project, 'wechat-mapping.json'))
  const mapping = JSON.parse(mappingBytes)
  const allowList = await wechatAllowList(input, files)
  const platform = target === 'alipay' ? 'ALIPAY' : 'WECHAT'
  const definitions = { platform, WECHAT: target === 'weapp', ALIPAY: target === 'alipay' }
  const compilerOptions = { platform, customMapping: target === 'weapp' ? mapping : {}, camelCaseProperty: true }
  const report = { schemaVersion: 1, mode, target, configuration, definitions, ifdefOptions, mapping: identity('wechat-mapping.json', mappingBytes), allowList, inputs: [], excluded: [], transformations: [] }
  const emitted = new Set()
  const { ifdef, TransformCompiler, Vinyl } = providers || {
    ifdef: require('@diamondyuan/gulp-ifdef'),
    TransformCompiler: require('@alipay/axml-transverter').TransformCompiler,
    Vinyl: require('vinyl'),
  }
  for (const file of files) {
    const raw = await fs.readFile(path.join(input, file))
    report.inputs.push(identity(file, raw))
    const reason = selectTemplate(file, target, allowList)
    if (reason) {
      report.excluded.push({ file, reason })
      continue
    }
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)
    const conditions = validateConditions(source)
    const preprocessed = await preprocess(source, file, definitions, ifdef, Vinyl)
    const stage = await writeOutput(output, `stages/${file}.txt`, preprocessed)
    const transformed = new TransformCompiler(compilerOptions).compile(preprocessed)
    assert.equal(typeof transformed, 'string', 'Official AXML compiler did not return template source')
    const [root, ...remaining] = file.split('/')
    const destination = `${['src', 'copilot'].includes(root) ? 'src' : 'demo'}/${remaining.join('/')}`.replace(/\.axml$/, target === 'weapp' ? '.wxml' : '.axml')
    assert.ok(!emitted.has(destination), 'Official Ant destination collision must be investigated')
    emitted.add(destination)
    const result = await writeOutput(output, `templates/${destination}`, transformed)
    report.transformations.push({ input: identity(file, raw), conditions, preprocessed: stage, output: result })
  }
  assert.ok(report.transformations.length, 'Ant pipeline selected no native template outputs')
  await writeOutput(output, 'pipeline.json', `${JSON.stringify(report, null, 2)}\n`)
}

module.exports = { main, validateConditions, supportsWechat, wechatAllowList, selectTemplate, preprocess }
if (require.main === module) {
  main(...process.argv.slice(2)).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
