# Wevu Vue Demo - Mini Program API Catalog Design

## Summary

Add a full WeChat Mini Program API catalog and representative demo pages to `apps/wevu-vue-demo`. The catalog is generated from `miniprogram-api-typings` for completeness and grouped by category with a small manual mapping. Each category gets 1-3 wevu-based demo cards with safe guards for permissions/config.

## Goals

- Generate a complete API list from `miniprogram-api-typings`.
- Group APIs by official doc category and render them in a new home page.
- Provide representative demos per category using wevu Composition API.
- Keep all demos resilient to missing permissions/config.

## Non-goals

- Full demo coverage for every single API.
- Deep integration with paid or restricted services (payment, ads, open platform).
- High-fidelity UI design beyond a simple, readable catalog.

## Data Sources

- `node_modules/miniprogram-api-typings/types/wx/lib.wx.api.d.ts`
- `node_modules/miniprogram-api-typings/types/wx/lib.wx.cloud.d.ts`

## Generated Data

Generator script:

- `apps/wevu-vue-demo/scripts/gen-miniprogram-api.js`
- Output: `apps/wevu-vue-demo/src/data/miniprogram-api.json`

Parsing rules:

- Read `interface Wx` members as `wx.*` APIs.
- Extract the first doc URL in JSDoc and map `/dev/api/<category>/...` to `categoryKey`.
- Default `categoryKey` to `misc` when no doc URL.
- Read `interface WxCloud` members as `wx.cloud.*` with `categoryKey = "cloud"`.

JSON shape (example):

```json
{
  "apis": [
    {
      "name": "getSystemInfo",
      "fullName": "wx.getSystemInfo",
      "categoryKey": "base",
      "docUrl": "https://developers.weixin.qq.com/miniprogram/dev/api/base/system/system-info/wx.getSystemInfo.html",
      "source": "wx"
    }
  ]
}
```

Manual category mapping:

- `apps/wevu-vue-demo/src/data/miniprogram-categories.ts`
- Provides display name, order, description, and demo page mapping.
- Missing categories fall back to a default label so the catalog is always complete.

## UI / Pages

- New home page: `apps/wevu-vue-demo/src/pages/index/index.vue`.
- Update `apps/wevu-vue-demo/src/app.vue` to put `pages/index/index` first.
- Home page shows:
  - Search + category filter chips.
  - Category sections with counts and foldable API lists.
  - Demo entry buttons per category.
  - Link to the existing `pages/wevu/index` intro page.

## Demo Pages

Location:

- `apps/wevu-vue-demo/src/pages/api-demos/<category>/index.vue`

Shared layout per page:

- Header + status banner.
- Demo cards with action buttons.
- Log panel for last success/error JSON.

Representative demos (examples):

- base: `wx.getSystemInfo`, `wx.getAppBaseInfo`
- device: `wx.getNetworkType`, `wx.vibrateShort`
- media: `wx.chooseImage`, `wx.previewImage`
- network: `wx.request`, `wx.downloadFile`
- ui: `wx.showToast`, `wx.showModal`
- storage: `wx.setStorageSync`, `wx.getStorageSync`
- location: `wx.getLocation`
- file: `wx.getFileSystemManager().readFile`
- canvas: `wx.createCanvasContext` basic draw
- navigate/route: `wx.navigateTo` to known routes
- open-api/payment/ads/cloud: availability check + guarded call + hint

## Error Handling

- Guard with `wx.canIUse` where possible.
- Catch and surface `errMsg` in a log area.
- Show "requires configuration" hints on restricted capabilities.

## Performance

- Avoid heavy components; use simple computed filtering.
- Fold long lists by default and render only the first N items unless expanded.

## Verification

- Regenerate list: `pnpm --filter wevu-vue-demo gen:api-list`
- Manual check in devtools:
  - Home page renders and filters correctly.
  - Demo pages run and show logs without crashing.
  - Restricted demos display guidance and fail gracefully.

## Risks / Open Questions

- Typings may include internal or deprecated APIs; use the doc URL presence to reduce noise.
- Some categories might be absent in the mapping; fallback labels should cover this.
