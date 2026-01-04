export default {
  '!(apps)/**/*.{js,jsx,mjs,ts,tsx,mts,vue}': [
    'eslint --fix --no-warn-ignored',
  ],
  '!(apps)/**/*.{json,md,mdx,css,html,yml,yaml,scss}': [
    // 'prettier --with-node-modules --ignore-path .prettierignore --write',
    'eslint --fix --no-warn-ignored',
  ],
  // Rust 相关
  // '*.rs': ['cargo fmt --'],
}
