# weapi 三端 API 兼容报告（总览）

- 类型来源：
  - 微信：`miniprogram-api-typings@5.1.1`
  - 支付宝：`@mini-types/alipay@3.0.14`
  - 抖音：`@douyin-microapp/typings@1.3.1`

## 全量统计

| 指标                             | 数值 |
| -------------------------------- | ---: |
| 微信方法数（基准命名）           |  479 |
| 支付宝方法数                     |  283 |
| 抖音方法数                       |  165 |
| 支付宝独有方法数（不在 wx 命名） |   93 |
| 抖音独有方法数（不在 wx 命名）   |   36 |
| 支付宝可按微信命名调用的方法数   |  192 |
| 抖音可按微信命名调用的方法数     |  129 |
| 三端完全对齐方法数               |  113 |

## 覆盖率

| 平台                    | 已支持 API 数 | API 总数 |  覆盖率 |
| ----------------------- | ------------: | -------: | ------: |
| 微信小程序 (`wx`)       |           479 |      479 | 100.00% |
| 支付宝小程序 (`my`)     |           192 |      479 |  40.08% |
| 抖音小程序 (`tt`)       |           129 |      479 |  26.93% |
| 三端完全对齐 (wx/my/tt) |           113 |      479 |  23.59% |

## 核心差异映射（手工规则）

| API                | 微信策略                                            | 支付宝策略                                                         | 抖音策略                                                         |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `showToast`        | 直连 `wx.showToast`                                 | `title/icon` 映射到 `content/type` 后调用 `my.showToast`           | `icon=error` 映射为 `fail` 后调用 `tt.showToast`                 |
| `showLoading`      | 直连 `wx.showLoading`                               | `title` 映射到 `content` 后调用 `my.showLoading`                   | 直连 `tt.showLoading`                                            |
| `showActionSheet`  | 直连 `wx.showActionSheet`                           | `itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐                | 直连 `tt.showActionSheet`，并兼容 `index` → `tapIndex`           |
| `showModal`        | 直连 `wx.showModal`                                 | 调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果                   | 直连 `tt.showModal`                                              |
| `chooseImage`      | 直连 `wx.chooseImage`                               | 返回值 `apFilePaths` 映射到 `tempFilePaths`                        | `tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底     |
| `saveFile`         | 微信当前 typings 未声明同名 API，保留为跨端扩展能力 | 请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath` | 直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath` |
| `setClipboardData` | 直连 `wx.setClipboardData`                          | 转调 `my.setClipboard` 并映射 `data` → `text`                      | 直连 `tt.setClipboardData`                                       |
| `getClipboardData` | 直连 `wx.getClipboardData`                          | 转调 `my.getClipboard` 并映射 `text` → `data`                      | 直连 `tt.getClipboardData`                                       |

## 已执行验证

- `pnpm --filter @wevu/api build`
- `pnpm --filter @wevu/api test`
- `pnpm --filter @wevu/api test:types`

## 目录

- [01-overview.md](./01-overview.md)
- [02-wx-method-list.md](./02-wx-method-list.md)
- [03-alipay-compat-matrix.md](./03-alipay-compat-matrix.md)
- [04-douyin-compat-matrix.md](./04-douyin-compat-matrix.md)
- [05-gap-notes.md](./05-gap-notes.md)
- [06-platform-only-methods.md](./06-platform-only-methods.md)
