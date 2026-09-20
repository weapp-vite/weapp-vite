import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const componentsPath = path.resolve(__dirname, '../../../packages-runtime/wevu/components.weapp.json')
const autoImportDirectory = path.resolve(__dirname, '../src/runtime/autoImport')
const outputDirectory = path.resolve(autoImportDirectory, 'weappBuiltinHtmlTagsData')
const wrapperOutputPath = path.resolve(autoImportDirectory, 'weappBuiltinHtmlTagsData.ts')
const CHECK_MODE = process.argv.includes('--check')
const GENERATED_FILE_HEADER = '// 本文件由 components.weapp.json 自动生成，请勿直接编辑。'
const GENERATED_DATA_LINT_DISABLE = '/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */'
const CHUNK_CONFIGS = [
  {
    fileName: 'adsAndMeta.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_ADS_AND_META',
    tags: [
      'ad',
      'ad-custom',
      'block',
      'match-media',
      'navigation-bar',
      'official-account',
      'open-data',
      'page-container',
      'page-meta',
      'share-element',
    ],
  },
  {
    fileName: 'templatesAndNavigation.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_TEMPLATES_AND_NAVIGATION',
    tags: [
      'functional-page-navigator',
      'import',
      'include',
      'navigator',
      'slot',
      'template',
      'web-view',
    ],
  },
  {
    fileName: 'formControlsPrimary.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_PRIMARY',
    tags: [
      'button',
      'checkbox',
      'checkbox-group',
      'editor',
      'form',
      'input',
      'keyboard-accessory',
      'label',
    ],
  },
  {
    fileName: 'formControlsSelection.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_SELECTION',
    tags: [
      'picker',
      'picker-view',
      'picker-view-column',
      'progress',
      'radio',
      'radio-group',
      'slider',
      'switch',
      'textarea',
    ],
  },
  {
    fileName: 'mediaPlayback.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_MEDIA_PLAYBACK',
    tags: [
      'audio',
      'image',
      'video',
    ],
  },
  {
    fileName: 'mediaCaptureLive.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_MEDIA_CAPTURE_LIVE',
    tags: [
      'camera',
      'canvas',
      'live-player',
      'live-pusher',
      'voip-room',
    ],
  },
  {
    fileName: 'mapAndMovable.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_MAP_AND_MOVABLE',
    tags: [
      'map',
      'movable-area',
      'movable-view',
    ],
  },
  {
    fileName: 'visualView.ts',
    exportName: 'WEAPP_BUILTIN_HTML_TAGS_VISUAL_VIEW',
    tags: [
      'cover-image',
      'cover-view',
      'icon',
      'rich-text',
      'scroll-view',
      'swiper',
      'swiper-item',
      'text',
      'view',
    ],
  },
]

function compareText(left, right) {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

function joinLines(value) {
  if (!value) {
    return undefined
  }
  const text = Array.isArray(value) ? value.join('\n') : value
  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeAttributeType(type) {
  if (!type) {
    return undefined
  }
  if (typeof type === 'string') {
    const trimmed = type.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof type === 'object') {
    const name = typeof type.name === 'string' ? type.name.trim() : ''
    if (!name) {
      return undefined
    }
    const returns = typeof type.returns?.name === 'string'
      ? type.returns.name.trim()
      : ''
    if (returns) {
      return `${name} => ${returns}`
    }
    return name
  }
  return undefined
}

function normalizeEnumValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined
  }
  const normalized = values
    .map((item) => {
      const name = item?.value !== undefined ? String(item.value) : ''
      if (!name) {
        return undefined
      }
      const entry = { name }
      if (item?.desc) {
        const desc = item.desc.trim()
        if (desc) {
          entry.description = desc
        }
      }
      return entry
    })
    .filter(entry => Boolean(entry))

  return normalized.length > 0 ? normalized : undefined
}

function toHtmlAttribute(attr) {
  const name = typeof attr?.name === 'string' ? attr.name.trim() : ''
  if (!name) {
    return undefined
  }
  const pieces = []
  const type = normalizeAttributeType(attr.type)
  if (type) {
    pieces.push(`Type: ${type}`)
  }
  const desc = joinLines(attr.desc)
  if (desc) {
    pieces.push(desc)
  }
  if (attr.defaultValue !== undefined) {
    pieces.push(`Default: ${String(attr.defaultValue)}`)
  }
  if (attr.since) {
    pieces.push(`Since: ${attr.since}`)
  }

  const entry = { name }
  if (pieces.length > 0) {
    entry.description = pieces.join('\n')
  }
  const values = normalizeEnumValues(attr.enum)
  if (values) {
    entry.values = values
  }
  return entry
}

function toHtmlTag(component) {
  const name = typeof component?.name === 'string' ? component.name.trim() : ''
  if (!name) {
    return undefined
  }
  const tag = { name }
  const desc = joinLines(component.desc)
  if (desc) {
    tag.description = desc
  }
  const attributes = component.attrs
    ?.map(toHtmlAttribute)
    .filter(entry => Boolean(entry))
    .sort((left, right) => compareText(left.name, right.name))
  if (attributes && attributes.length > 0) {
    tag.attributes = attributes
  }
  if (component.docLink) {
    tag.references = [
      {
        name: 'WeChat Mini Program docs',
        url: component.docLink,
      },
    ]
  }
  return tag
}

function createChunkAssignments(tags) {
  const tagByName = new Map(tags.map(tag => [tag.name, tag]))
  if (tagByName.size !== tags.length) {
    throw new Error('components.weapp.json contains duplicate component names')
  }
  const assignedNames = new Set()
  const chunks = CHUNK_CONFIGS.map((config) => {
    const chunkTags = config.tags.map((name) => {
      if (assignedNames.has(name)) {
        throw new Error(`Component ${name} is assigned to more than one generated chunk`)
      }
      const tag = tagByName.get(name)
      if (!tag) {
        throw new Error(`Generated chunk ${config.fileName} references missing component ${name}`)
      }
      assignedNames.add(name)
      return tag
    })
    return { config, tags: chunkTags }
  })
  const unassignedNames = tags
    .map(tag => tag.name)
    .filter(name => !assignedNames.has(name))
  if (unassignedNames.length > 0) {
    throw new Error(`Components missing a generated chunk assignment: ${unassignedNames.join(', ')}`)
  }
  return chunks
}

function renderChunk(exportName, tags) {
  return [
    GENERATED_FILE_HEADER,
    GENERATED_DATA_LINT_DISABLE,
    '',
    `export const ${exportName} = ${JSON.stringify(tags, null, 2)}`,
    '',
  ].join('\n')
}

function renderIndex(chunks) {
  const importLines = [...chunks]
    .sort((left, right) => compareText(left.config.fileName, right.config.fileName))
    .map(({ config }) => `import { ${config.exportName} } from './${config.fileName.replace(/\.ts$/, '')}'`)
  return [
    GENERATED_FILE_HEADER,
    '',
    ...importLines,
    '',
    'export const WEAPP_BUILTIN_HTML_TAGS = [',
    ...chunks.map(({ config }) => `  ...${config.exportName},`),
    ']',
    '',
  ].join('\n')
}

function renderWrapper() {
  return [
    GENERATED_FILE_HEADER,
    '',
    'export * from \'./weappBuiltinHtmlTagsData/index\'',
    '',
  ].join('\n')
}

async function collectDrift(expectedOutputs) {
  const drift = []
  for (const [outputPath, expectedContent] of expectedOutputs) {
    if (!await fs.pathExists(outputPath)) {
      drift.push(`${path.relative(process.cwd(), outputPath)} is missing`)
      continue
    }
    const actualContent = await fs.readFile(outputPath, 'utf8')
    if (actualContent !== expectedContent) {
      drift.push(`${path.relative(process.cwd(), outputPath)} differs`)
    }
  }
  const expectedChunkPaths = new Set(
    [...expectedOutputs.keys()].filter(outputPath => path.dirname(outputPath) === outputDirectory),
  )
  if (await fs.pathExists(outputDirectory)) {
    for (const entry of await fs.readdir(outputDirectory, { withFileTypes: true })) {
      const entryPath = path.resolve(outputDirectory, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts') && !expectedChunkPaths.has(entryPath)) {
        drift.push(`${path.relative(process.cwd(), entryPath)} is stale`)
      }
    }
  }
  return drift
}

async function writeOutputs(expectedOutputs) {
  await fs.ensureDir(outputDirectory)
  const expectedChunkPaths = new Set(
    [...expectedOutputs.keys()].filter(outputPath => path.dirname(outputPath) === outputDirectory),
  )
  for (const entry of await fs.readdir(outputDirectory, { withFileTypes: true })) {
    const entryPath = path.resolve(outputDirectory, entry.name)
    if (entry.isFile() && entry.name.endsWith('.ts') && !expectedChunkPaths.has(entryPath)) {
      await fs.remove(entryPath)
    }
  }
  for (const [outputPath, content] of expectedOutputs) {
    await fs.outputFile(outputPath, content, 'utf8')
  }
}

const components = await fs.readJson(componentsPath)
if (!Array.isArray(components) || components.length === 0) {
  throw new Error('components.weapp.json must contain a non-empty component array')
}
const tags = components
  .map(toHtmlTag)
  .filter(entry => Boolean(entry))
  .sort((left, right) => compareText(left.name, right.name))
if (tags.length !== components.length) {
  throw new Error('components.weapp.json contains a component without a valid name')
}
const chunks = createChunkAssignments(tags)
const expectedOutputs = new Map(
  chunks.map(({ config, tags: chunkTags }) => [
    path.resolve(outputDirectory, config.fileName),
    renderChunk(config.exportName, chunkTags),
  ]),
)
expectedOutputs.set(path.resolve(outputDirectory, 'index.ts'), renderIndex(chunks))
expectedOutputs.set(wrapperOutputPath, renderWrapper())

if (CHECK_MODE) {
  const drift = await collectDrift(expectedOutputs)
  if (drift.length > 0) {
    throw new Error(`Generated WeChat HTML tag data is out of date:\n${drift.map(item => `- ${item}`).join('\n')}`)
  }
  console.log(`Checked ${expectedOutputs.size} generated WeChat HTML tag files.`)
}
else {
  await writeOutputs(expectedOutputs)
  console.log(`Generated ${expectedOutputs.size} WeChat HTML tag files from ${path.relative(process.cwd(), componentsPath)}.`)
}
