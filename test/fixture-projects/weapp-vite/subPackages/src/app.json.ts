export default {
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/index/index",
    "pages/index/vue"
  ],
  "window": {},
  "style": "v2",
  "componentFramework": "glass-easel",
  "sitemapLocation": "sitemap.json",
  subPackages: [
    {
      root: 'packageA',
      name: 'pack1',
      pages: [
        'pages/cat',
        'pages/dog',
      ],
      "entry": "index.js",
      // configFile: './vite.packageA.config.ts'
    },
    {
      root: 'packageB',
      name: 'pack2',
      pages: [
        'pages/apple',
        'pages/banana',
      ],
      // 必须使用 js?
      "entry": "index.js",
      // 独立分包应该特殊处理, 单独创建上下文
      independent: true,
    },
  ],
}