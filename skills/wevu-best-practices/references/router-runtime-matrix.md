# Router Runtime Matrix

| 需求                    | API                               | 边界                               |
| ----------------------- | --------------------------------- | ---------------------------------- |
| 直接调用宿主导航        | 根入口 native router helpers      | 不提供统一 route records/guards    |
| 统一导航、守卫、resolve | `wevu/router`                     | 小程序没有标准前进语义             |
| 页面布局切换            | `setPageLayout` / `usePageLayout` | 依赖当前 page/layout host 生命周期 |

`router.forward()` 返回 aborted failure 是平台预期，不按浏览器历史栈解释。
