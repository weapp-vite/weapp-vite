import type { MiniappTutorialPlatform } from './config'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  MINIAPP_PLATFORM_OUTPUTS,

} from './config'

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

export async function assertFiles(root: string, relativePaths: string[]) {
  const missing: string[] = []
  for (const relativePath of relativePaths) {
    if (!await pathExists(path.join(root, relativePath))) {
      missing.push(relativePath)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing tutorial output files:\n${missing.map(file => `- ${file}`).join('\n')}`)
  }
}

export async function assertGuideBuild(projectDir: string) {
  await assertFiles(path.join(projectDir, 'dist'), [
    'app.js',
    'app.json',
    'pages/index/index.js',
    'pages/index/index.json',
    'pages/index/index.wxml',
    'pages/index/index.wxss',
  ])
}

export async function assertHandbookBuild(projectDir: string) {
  const distRoot = path.join(projectDir, 'dist')
  await assertFiles(distRoot, [
    'app.js',
    'app.json',
    'pages/index/index.js',
    'pages/index/index.json',
    'pages/index/index.wxml',
    'pages/index/index.wxss',
  ])
  const pageJson = JSON.parse(
    await fs.readFile(path.join(distRoot, 'pages/index/index.json'), 'utf8'),
  ) as { navigationBarTitleText?: string }
  if (pageJson.navigationBarTitleText !== '首页') {
    throw new Error(`Unexpected handbook page title: ${pageJson.navigationBarTitleText ?? '<missing>'}`)
  }
  const wxml = await fs.readFile(path.join(distRoot, 'pages/index/index.wxml'), 'utf8')
  for (const stableText of ['Hello Weapp-vite', 'count:', 'doubled:']) {
    if (!wxml.includes(stableText)) {
      throw new Error(`Handbook WXML is missing stable text: ${stableText}`)
    }
  }
}

export async function assertMultiPlatformBuild(
  projectDir: string,
  platform: MiniappTutorialPlatform,
) {
  const distRoot = path.join(projectDir, 'dist', platform, 'dist')
  const output = MINIAPP_PLATFORM_OUTPUTS[platform]
  await assertFiles(distRoot, [
    'app.js',
    'app.json',
    output.appStyle,
    'pages/index/index.js',
    'pages/index/index.json',
    output.pageStyle,
    output.pageTemplate,
  ])
}

export async function assertMultiPlatformWebBuild(projectDir: string) {
  await assertFiles(path.join(projectDir, 'dist/web'), ['index.html'])
}
