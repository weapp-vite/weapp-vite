export default {
  "$schema": "https://ice-vite.netlify.app/app.json",
  "pages": [
    "pages/index/index",
    "pages/index/vue"
  ],
  "window": {},
  "style": "v2",
  "componentFramework": "glass-easel",
  "sitemapLocation": "sitemap.json",
  workers: {
    path: 'workers',
    isSubpackage: true,
  },
}