const WECHAT_DEVTOOLS_PROJECT_CONFIG_RE = /^(?:apps|e2e-apps|templates)\/.+\/project(?:\.private)?\.config\.json$/

function filterGeneratedWechatMirrorDocs(files) {
  return files.filter((file) => {
    return !file.includes('/docs/wechat-miniprogram/framework/')
      && !file.startsWith('docs/wechat-miniprogram/framework/')
  })
}

function filterWechatDevtoolsProjectConfigs(files) {
  return files.filter((file) => {
    return !WECHAT_DEVTOOLS_PROJECT_CONFIG_RE.test(file)
  })
}

export default {
  'skills/**/*.{yaml,yml}': [
    'node skills/scripts/validate-skills-yaml.mjs',
  ],
  '!(apps)/**/*.{js,jsx,mjs,ts,tsx,mts,vue}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
  ],
  '!(apps)/**/*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
  '!(apps)/**/*.{json,md,mdx,html,yml,yaml}': (files) => {
    const lintableFiles = filterWechatDevtoolsProjectConfigs(filterGeneratedWechatMirrorDocs(files))

    if (lintableFiles.length === 0) {
      return []
    }

    return [
      // 'prettier --with-node-modules --ignore-path .prettierignore --write',
      `eslint --fix --max-warnings=0 --no-warn-ignored ${lintableFiles.join(' ')}`,
    ]
  },
  // Rust 相关
  // '*.rs': ['cargo fmt --'],
}
