const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const appRoot = path.resolve(__dirname, '..')
const typingsRoot = path.join(
  appRoot,
  'node_modules',
  'miniprogram-api-typings',
  'types',
  'wx',
)
const apiFile = path.join(typingsRoot, 'lib.wx.api.d.ts')
const cloudFile = path.join(typingsRoot, 'lib.wx.cloud.d.ts')
const outputFile = path.join(appRoot, 'src', 'data', 'miniprogram-api.json')

function deriveCategoryKey(docUrl) {
  if (!docUrl) {
    return 'misc'
  }
  const marker = '/miniprogram/dev/api/'
  const index = docUrl.indexOf(marker)
  if (index === -1) {
    return 'misc'
  }
  const rest = docUrl.slice(index + marker.length)
  const key = rest.split('/')[0]
  return key || 'misc'
}

function readInterfaceMembers(filePath, interfaceName) {
  const text = fs.readFileSync(filePath, 'utf8')
  const source = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
  )
  const members = new Map()

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      node.members.forEach((member) => {
        if (!member.name || !ts.isIdentifier(member.name)) {
          return
        }
        const name = member.name.text
        const commentRanges = ts.getLeadingCommentRanges(text, member.pos) || []
        const lastRange = commentRanges[commentRanges.length - 1]
        const commentText = lastRange
          ? text.slice(lastRange.pos, lastRange.end)
          : ''
        const docUrlMatch = commentText.match(
          /https:\/\/developers\.weixin\.qq\.com\/miniprogram\/dev\/api\/[^\s)]+/,
        )
        const docUrl = docUrlMatch ? docUrlMatch[0] : null
        const existing = members.get(name)
        if (!existing || (!existing.docUrl && docUrl)) {
          members.set(name, { name, docUrl })
        }
      })
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return Array.from(members.values())
}

function buildApiList() {
  const wxMembers = readInterfaceMembers(apiFile, 'Wx')
  const cloudMembers = readInterfaceMembers(cloudFile, 'WxCloud')
  const entries = []

  wxMembers.forEach((item) => {
    entries.push({
      name: item.name,
      fullName: `wx.${item.name}`,
      categoryKey: deriveCategoryKey(item.docUrl),
      docUrl: item.docUrl,
      source: 'wx',
    })
  })

  cloudMembers.forEach((item) => {
    entries.push({
      name: item.name,
      fullName: `wx.cloud.${item.name}`,
      categoryKey: 'cloud',
      docUrl: item.docUrl,
      source: 'wx.cloud',
    })
  })

  entries.sort((a, b) => a.fullName.localeCompare(b.fullName))
  return entries
}

function writeOutput(apis) {
  const payload = {
    generatedAt: new Date().toISOString(),
    apis,
  }
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8')
}

function main() {
  if (!fs.existsSync(apiFile)) {
    throw new Error(`Missing typings file: ${apiFile}`)
  }
  if (!fs.existsSync(cloudFile)) {
    throw new Error(`Missing typings file: ${cloudFile}`)
  }

  const apis = buildApiList()
  writeOutput(apis)
  console.log(`[gen] wrote ${apis.length} entries to ${outputFile}`)
}

main()
