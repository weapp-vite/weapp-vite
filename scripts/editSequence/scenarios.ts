import type { EditSequence } from './driver'

export const editorSource = '<script setup>\nconst title = "one"\n</script>\n<template><view>{{ title }}</view></template>\n<style>.page { color: red; }</style>'
const scriptEnd = editorSource.indexOf('</script>')

export const positionDriftSequence: EditSequence = {
  name: 'editor-newline-position',
  files: { 'page.vue': editorSource },
  steps: [{ name: 'insert newline in script', action: { kind: 'edit', file: 'page.vue', start: scriptEnd, end: scriptEnd, text: '\n' } }],
}

const externalSource = `${editorSource.replace('<style>.page { color: red; }</style>', '')}<style src="./theme.css"></style>`

export const compilerSequences: EditSequence[] = [
  {
    name: 'compiler-content-newlines',
    files: { 'page.vue': editorSource },
    steps: [
      { name: 'ordinary content edit', action: { kind: 'write', file: 'page.vue', content: editorSource.replace('one', 'two') } },
      { name: 'insert newline', action: { kind: 'edit', file: 'page.vue', start: scriptEnd, end: scriptEnd, text: '\n' } },
      { name: 'delete newline', action: { kind: 'edit', file: 'page.vue', start: scriptEnd, end: scriptEnd + 1, text: '' } },
    ],
  },
  {
    name: 'compiler-external-missing-recovery',
    files: { 'page.vue': externalSource, 'theme.css': '.page { color: red; }' },
    steps: [
      { name: 'external block edit', action: { kind: 'write', file: 'theme.css', content: '.page { color: blue; }' } },
      { name: 'remove external dependency', action: { kind: 'delete', file: 'theme.css' } },
      { name: 'create missing dependency', action: { kind: 'write', file: 'theme.css', content: '.page { color: green; }' } },
      { name: 'rename dependency', action: { kind: 'rename', file: 'theme.css', to: 'renamed.css' } },
      { name: 'repair renamed reference', action: { kind: 'write', file: 'page.vue', content: externalSource.replace('theme.css', 'renamed.css') } },
    ],
  },
  {
    name: 'compiler-errors-config-rapid-delete',
    files: { 'page.vue': editorSource },
    steps: [
      { name: 'erroneous script', action: { kind: 'write', file: 'page.vue', content: editorSource.replace('const title = "one"', 'const title =') } },
      { name: 'repair script', action: { kind: 'write', file: 'page.vue', content: editorSource } },
      { name: 'change component configuration', action: { kind: 'config', file: 'sequence.config.json', content: '{"isPage":false}' } },
      { name: 'rapid saves', action: { kind: 'rapid', saves: [
        { kind: 'write', file: 'page.vue', content: editorSource.replace('one', 'two') },
        { kind: 'write', file: 'page.vue', content: editorSource.replace('one', 'three') },
      ] } },
      { name: 'rename SFC', action: { kind: 'rename', file: 'page.vue', to: 'renamed.vue' } },
      { name: 'delete SFC', action: { kind: 'delete', file: 'renamed.vue' } },
    ],
  },
]

const buildPage = '<script>export default { data() { return { title: "one" } } }</script>\n<template><view>{{ title }}</view></template>\n<style src="./theme.css"></style>'
const main = 'import page from "./page.vue"; import { value } from "./value.js"; export function snapshot() { return { value, page: page.data(), configured: typeof SEQUENCE_FLAG === "undefined" ? "default" : SEQUENCE_FLAG }; }\nif (import.meta.hot) import.meta.hot.accept();'
const buildFiles = { 'main.js': main, 'value.js': 'export const value = "one";', 'page.vue': buildPage, 'theme.css': '.page { color: red; }' }

export const buildSequences: EditSequence[] = [
  {
    name: 'build-content-newlines-external',
    files: buildFiles,
    steps: [
      { name: 'unchanged save', action: { kind: 'write', file: 'value.js', content: buildFiles['value.js'] } },
      { name: 'ordinary dependency edit', action: { kind: 'write', file: 'value.js', content: 'export const value = "two";' } },
      { name: 'insert newline', action: { kind: 'edit', file: 'main.js', start: 0, end: 0, text: '\n' } },
      { name: 'delete newline', action: { kind: 'edit', file: 'main.js', start: 0, end: 1, text: '' } },
      { name: 'external SFC style edit', action: { kind: 'write', file: 'theme.css', content: '.page { color: blue; }' } },
    ],
  },
  {
    name: 'build-missing-delete-rename-recovery',
    files: buildFiles,
    steps: [
      { name: 'import missing dependency', action: { kind: 'write', file: 'main.js', content: main.replace('./value.js', './missing.js') } },
      { name: 'create missing dependency', action: { kind: 'write', file: 'missing.js', content: 'export const value = "created";' } },
      { name: 'delete dependency', action: { kind: 'delete', file: 'missing.js' } },
      { name: 'restore dependency', action: { kind: 'write', file: 'missing.js', content: 'export const value = "restored";' } },
      { name: 'rename dependency', action: { kind: 'rename', file: 'missing.js', to: 'renamed.js' } },
      { name: 'repair renamed reference', action: { kind: 'write', file: 'main.js', content: main.replace('./value.js', './renamed.js') } },
    ],
  },
  {
    name: 'build-erroneous-config-rapid',
    files: { ...buildFiles, 'unused.js': 'export const value = "unused";' },
    steps: [
      { name: 'syntax failure', action: { kind: 'write', file: 'value.js', content: 'export const value = ;' } },
      { name: 'unchanged failed input', action: { kind: 'write', file: 'value.js', content: 'export const value = ;' } },
      { name: 'syntax recovery', action: { kind: 'write', file: 'value.js', content: 'export const value = "recovered";' } },
      { name: 'config restart', action: { kind: 'config', file: 'sequence.config.json', content: JSON.stringify({ define: { SEQUENCE_FLAG: JSON.stringify('configured') } }) } },
      { name: 'unreferenced dependency edit', action: { kind: 'write', file: 'unused.js', content: 'export const value = "still unused";' } },
      { name: 'rapid saves', action: { kind: 'rapid', saves: [
        { kind: 'write', file: 'value.js', content: 'export const value = "intermediate";' },
        { kind: 'write', file: 'value.js', content: 'export const value = "final";' },
      ] } },
      { name: 'rapid restore of original bytes', action: { kind: 'rapid', saves: [
        { kind: 'write', file: 'value.js', content: 'export const value = "discarded";' },
        { kind: 'write', file: 'value.js', content: 'export const value = "final";' },
      ] } },
      { name: 'rapid error recovery', action: { kind: 'rapid', saves: [
        { kind: 'write', file: 'value.js', content: 'export const value = ;' },
        { kind: 'write', file: 'value.js', content: 'export const value = "repaired";' },
      ] } },
      { name: 'rapidly import and edit an existing unused dependency', action: { kind: 'rapid', saves: [
        { kind: 'write', file: 'main.js', content: main.replace('export function', 'import { value as additional } from "./unused.js"; export function').replace('return { value,', 'return { value, additional,') },
        { kind: 'write', file: 'unused.js', content: 'export const value = "newly imported";' },
      ] } },
    ],
  },
  {
    name: 'build-external-script-error-recovery',
    files: { ...buildFiles, 'external.js': 'export default { data() { return { title: ; } } }' },
    steps: [
      { name: 'request existing erroneous external script', action: { kind: 'write', file: 'page.vue', content: buildPage.replace(/<script>.*?<\/script>/, '<script src="./external.js"></script>') } },
      { name: 'repair only external script', action: { kind: 'write', file: 'external.js', content: 'export default { data() { return { title: "external recovered" } } }' } },
    ],
  },
]
