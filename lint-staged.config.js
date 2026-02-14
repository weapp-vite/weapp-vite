export default {
  '!(apps)/**/*.{js,jsx,mjs,ts,tsx,mts,vue}': [
    'eslint --fix --no-warn-ignored',
  ],
  '!(apps)/**/*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
  '!(apps)/**/*.{json,md,mdx,html,yml,yaml}': [
    // 'prettier --with-node-modules --ignore-path .prettierignore --write',
    'eslint --fix --no-warn-ignored',
  ],
  // Rust 相关
  // '*.rs': ['cargo fmt --'],
}
