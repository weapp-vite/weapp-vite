export const sharedFragment = (
  <view className="card">
    <text>跨文件静态 JSX fragment</text>
  </view>
)

export const createSharedPanel = (title: string) => (
  <view className="card">
    <text>{title}</text>
  </view>
)

export const createDynamicBlock = <T,>(factory: () => T): T => factory()
