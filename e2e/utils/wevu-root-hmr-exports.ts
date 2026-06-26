import { WEVU_ROOT_HMR_EXPORTS } from '../generated/wevu-root-hmr-exports'

function toRootExportLocalName(exportName: string) {
  return `__wevuRoot_${exportName.replaceAll(/\W/g, '_')}`
}

export function createWevuRootImportHmrComposableSource(marker: string) {
  const aliases = WEVU_ROOT_HMR_EXPORTS.map(exportName => ({
    exportName,
    localName: toRootExportLocalName(exportName),
  }))

  return [
    'import {',
    ...aliases.map(({ exportName, localName }) => `  ${exportName} as ${localName},`),
    '} from \'wevu\'',
    '',
    'const rootExportKinds = [',
    ...aliases.map(({ localName }) => `  typeof ${localName},`),
    ']',
    `const rootExportGuardCount = ${WEVU_ROOT_HMR_EXPORTS.length}`,
    '',
    'export function useRootImportHmr() {',
    `  const title = __wevuRoot_ref('${marker}')`,
    '  const label = __wevuRoot_computed(() => `root:${__wevuRoot_unref(title)'.concat('}`)'),
    '  __wevuRoot_onShareAppMessage(() => ({ title: __wevuRoot_unref(label) }))',
    '  return { label, rootExportGuardCount, rootExportKinds }',
    '}',
    '',
  ].join('\n')
}

export { WEVU_ROOT_HMR_EXPORTS }
