import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const SCRIPT_SETUP_EXTERNAL_FIXTURE = 'e2e-apps/auto-import-vue-sfc'
export const SCRIPT_SETUP_EXTERNAL_ROUTE = '/pages/index/index'
export const SCRIPT_SETUP_EXTERNAL_CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
export const SCRIPT_SETUP_EXTERNAL_HOST = '<template src="./template.html"></template>\n<script setup lang="ts" src="./setup.ts"></script>\n'

export const SCRIPT_SETUP_EXTERNAL_STEPS = [
  { id: 'initial', marker: 'external-initial', component: 'AutoCard', imported: 'AutoCard', text: 'auto-card' },
  { id: 'template-edit', marker: 'external-template', component: 'AutoCard', imported: 'AutoCard', text: 'auto-card' },
  { id: 'script-edit', marker: 'external-template', component: 'AlternateCard', imported: 'AlternateCard', text: 'alternate-card' },
  { id: 'remove-template', marker: 'external-removed', component: null, imported: 'AlternateCard', text: null },
  { id: 'remove-script', marker: 'external-removed', component: null, imported: null, text: null },
  { id: 'restore-script', marker: 'external-removed', component: null, imported: 'AutoCard', text: null },
  { id: 'restore', marker: 'external-restored', component: 'AutoCard', imported: 'AutoCard', text: 'auto-card' },
] as const

export function externalComponentTemplate(marker: string, enabled = true) {
  return `<view id="external-page"><view id="external-marker">${marker}</view>${enabled ? '<local-card id="external-card" />' : ''}</view>`
}

export function externalComponentScript(component: string | null) {
  return component ? `import LocalCard from '../../components/${component}/index.vue'\n` : ''
}

/** 只修改现有自动导入 fixture 的临时副本，保留真实 AppID 与既有页面条件。 */
export async function createScriptSetupExternalProject() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'script-setup-external-'))
  const fixture = path.join(ROOT, SCRIPT_SETUP_EXTERNAL_FIXTURE)
  for (const entry of ['src', 'project.config.json', 'project.private.config.json', 'weapp-vite.config.ts', 'package.json']) {
    await cp(path.join(fixture, entry), path.join(project, entry), { recursive: true })
  }
  await mkdir(path.join(project, 'node_modules'))
  for (const [name, relative] of [['weapp-vite', 'packages/weapp-vite'], ['wevu', 'packages-runtime/wevu']] as const) {
    await symlink(await realpath(path.join(ROOT, relative)), path.join(project, 'node_modules', name), 'junction')
  }
  const privatePath = path.join(project, 'project.private.config.json')
  const privateConfig = JSON.parse(await readFile(privatePath, 'utf8')) as { setting?: Record<string, unknown> }
  privateConfig.setting = { ...privateConfig.setting, compileHotReLoad: false }
  await writeFile(privatePath, `${JSON.stringify(privateConfig, null, 2)}\n`)
  const alternate = path.join(project, 'src/components/AlternateCard')
  await mkdir(alternate)
  const componentScripts = path.join(project, 'src/componentScripts')
  await mkdir(componentScripts)
  await writeFile(path.join(alternate, 'index.vue'), '<script setup lang="ts" src="../../componentScripts/alternate.ts"></script>\n<template><view>{{ caption }}</view></template>\n')
  await writeFile(path.join(componentScripts, 'alternate.ts'), 'import { caption } from \'./caption\'\n')
  await writeFile(path.join(componentScripts, 'caption.ts'), 'export const caption = \'alternate-card\'\n')
  const page = path.join(project, 'src/pages/index')
  await writeFile(path.join(page, 'index.vue'), SCRIPT_SETUP_EXTERNAL_HOST)
  await writeFile(path.join(page, 'template.html'), externalComponentTemplate('external-initial'))
  await writeFile(path.join(page, 'setup.ts'), externalComponentScript('AutoCard'))
  return project
}
