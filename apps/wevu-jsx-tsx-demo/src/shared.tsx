export const sharedFragment = (
  <view className="card">
    <text>跨文件静态 JSX fragment</text>
  </view>
)

export function createSharedPanel(title: string) {
  return (
    <view className="card">
      <text>{title}</text>
    </view>
  )
}

export const createDynamicBlock = <T,>(factory: () => T): T => factory()
