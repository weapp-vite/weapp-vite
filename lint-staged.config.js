const WECHAT_DEVTOOLS_PROJECT_CONFIG_RE = /(?:^|\/)project(?:\.private)?\.config\.json$/

function isWechatDevtoolsProjectConfig(file) {
  return WECHAT_DEVTOOLS_PROJECT_CONFIG_RE.test(file)
}

function filterWechatDevtoolsProjectConfigs(files) {
  return files.filter((file) => {
    return !isWechatDevtoolsProjectConfig(file)
  })
}

export default {
  '**/project{,.private}.config.json': (files) => {
    const projectConfigFiles = files.filter(isWechatDevtoolsProjectConfig)

    if (projectConfigFiles.length === 0) {
      return []
    }

    return [`node scripts/fix-wechat-devtools-project-config-eof.mjs ${projectConfigFiles.join(' ')}`]
  },
  'skills/**/*.{yaml,yml}': ['node skills/scripts/validate-skills-yaml.mjs'],
  '!(apps)/**/*.{js,jsx,mjs,ts,tsx,mts,vue}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
  ],
  '!(apps)/**/*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
  '!(apps)/**/*.{json,md,mdx,html,yml,yaml}': (files) => {
    const lintableFiles = filterWechatDevtoolsProjectConfigs(files)

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
