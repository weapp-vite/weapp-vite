export interface ClassicScopeCase {
  name: string
  supported: boolean
}

/** 复用既有用例名称冻结混合文件的范围，不复制或弱化其运行时断言。 */
export const CLASSIC_IDE_CASES: Record<string, ClassicScopeCase[]> = {
  'ide/issue-1015-css-hmr.runtime.test.ts': [
    { name: 'issue #1015 external CSS HMR: classic > renders all seven updates including removing and restoring every CSS variable', supported: true },
    { name: 'issue #1015 external CSS HMR: stateful-experimental > renders all seven updates including removing and restoring every CSS variable', supported: false },
  ],
  'ide/issue-1134-native-batch.runtime.test.ts': [
    { name: 'issue #1134 native four-file runtime (classic) > renders matching script, template, style and config batches on repeated saves and restoration', supported: true },
    { name: 'issue #1134 native four-file runtime (stateful-experimental) > persists a native script saved on the first actual sidecar notification', supported: false },
    { name: 'issue #1134 native four-file runtime (stateful-experimental) > renders matching script, template, style and config batches on repeated saves and restoration', supported: false },
  ],
  'ide/issue-1134-native-topology.runtime.test.ts': [
    { name: 'issue #1134 native dependencies runtime (classic) > renders imported style updates and added components and routes after restoration', supported: true },
    { name: 'issue #1134 native dependencies runtime (stateful-experimental) > renders imported style updates and added components and routes after restoration', supported: false },
  ],
  'ide/hmr-additional-capabilities.runtime.test.ts': [
    { name: 'wv engine-full-reload real source capability fallback > uses the real source boundary and stays classic through subsequent edits and restoration', supported: false },
    { name: 'wv patch-shape real source capability fallback > uses the real source boundary and stays classic through subsequent edits and restoration', supported: false },
    { name: 'wv skyline real source capability fallback > uses the real source boundary and stays classic through subsequent edits and restoration', supported: true },
  ],
}

/** 构建护栏沿用原 classic 分支；实验管线仍可从原诊断入口独立运行。 */
export const CLASSIC_BUILD_CASES: Record<string, ClassicScopeCase[]> = {
  'ci/hmr-native-batch.test.ts': [
    { name: 'native four-file batch (classic) > publishes every member on first, repeated, reversed and restored saves', supported: true },
    { name: 'native four-file batch (stateful-experimental) > publishes every member on first, repeated, reversed and restored saves', supported: false },
  ],
  'ci/hmr-native-dependencies.test.ts': [
    { name: 'native style and topology updates (classic) > updates imported styles and publishes and revokes complete component and page outputs', supported: true },
    { name: 'native style and topology updates (stateful-experimental) > updates imported styles and publishes and revokes complete component and page outputs', supported: false },
  ],
  'ci/hmr-issue-1015-external-css-vars.test.ts': [
    { name: 'issue #1015 external CSS variables HMR > updates external CSS variable registration in classic mode', supported: true },
    { name: 'issue #1015 external CSS variables HMR > updates external CSS variable registration in stateful-experimental mode', supported: false },
  ],
  'ci/hmr-asset-ownership.test.ts': [
    ...['updates copied assets with auto import disabled', 'watches a public directory created after startup', 'updates public assets through repeated edits and creation', 'removes deleted copied and public assets and restores the same bytes'].flatMap(action => [
      { name: `copied asset watch ownership > ${action} in classic`, supported: true },
      { name: `copied asset watch ownership > ${action} in stateful-experimental`, supported: false },
    ]),
  ],
  'ci/hmr-request-globals-prelude.test.ts': [
    { name: 'request globals publication generations (classic) > keeps prelude initialization and unrelated components stable across stylesheet and template saves', supported: true },
    { name: 'request globals publication generations (stateful-experimental) > keeps prelude initialization and unrelated components stable across stylesheet and template saves', supported: false },
  ],
  'ci/native-sidecar-watch.hmr.test.ts': [
    { name: 'standalone JSON sidecar watch (classic) > publishes edits and restoration without a script or template change', supported: true },
    { name: 'standalone JSON sidecar watch (stateful-experimental) > publishes edits and restoration without a script or template change', supported: false },
  ],
}
