export type ProductCategory = '咖啡豆' | '挂耳' | '器具'
export type ShopCategory = '全部' | ProductCategory

export interface Product {
  id: string
  title: string
  category: ProductCategory
  hint: string
  description: string
  price: number
  specs: string[]
  stock: number
}

export interface Address {
  id: string
  title: string
  detail: string
}

export interface CartLine {
  id: string
  productId: string
  spec: string
  quantity: number
  selected: boolean
}

export interface Order {
  id: string
  addressId: string
  lines: CartLine[]
  subtotal: number
  shipping: number
  total: number
  createdAt: number
  simulation: true
}

export interface ShopState {
  cart: CartLine[]
  orders: Order[]
  addressId: string
  checkoutLines: CartLine[]
  checkoutKind: 'cart' | 'buy' | null
}
