import type { Address, Product, ShopCategory } from './types'

export const categories: ShopCategory[] = ['全部', '咖啡豆', '挂耳', '器具']

export const products: Product[] = [
  {
    id: 'dawn',
    title: '晨光拼配',
    category: '咖啡豆',
    hint: '柑橘、焦糖 · 200g',
    description: '明亮柑橘与焦糖甜感，适合手冲和日常美式。',
    price: 6800,
    specs: ['整豆 200g', '研磨粉 200g'],
    stock: 18,
  },
  {
    id: 'cocoa',
    title: '可可深烘',
    category: '咖啡豆',
    hint: '黑巧、坚果 · 200g',
    description: '浓郁黑巧与烤坚果风味，适合奶咖和意式冲煮。',
    price: 7200,
    specs: ['整豆 200g', '研磨粉 200g'],
    stock: 14,
  },
  {
    id: 'drift',
    title: '山野挂耳',
    category: '挂耳',
    hint: '花香、红茶 · 8 袋',
    description: '轻盈花香与红茶尾韵，撕开即可完成一杯手冲。',
    price: 4900,
    specs: ['8 袋装'],
    stock: 24,
  },
  {
    id: 'pour',
    title: '陶瓷手冲套装',
    category: '器具',
    hint: '陶瓷滤杯与玻璃壶',
    description: '适合一至两人使用的陶瓷滤杯与耐热玻璃分享壶。',
    price: 12900,
    specs: ['滤杯与分享壶'],
    stock: 8,
  },
]

export const addresses: Address[] = [
  {
    id: 'demo-a',
    title: '示例地址 A',
    detail: '浙江省杭州市 · 示例街道 88 号',
  },
  {
    id: 'demo-b',
    title: '示例地址 B',
    detail: '浙江省杭州市 · 示例园区 16 号',
  },
]

const productById = new Map(products.map(product => [product.id, product]))
const addressIds = new Set(addresses.map(address => address.id))

/** 根据标识读取商品。 */
export function getProduct(id: string): Product | undefined {
  return productById.get(id)
}

/** 判断标识是否为模板内置的演示地址。 */
export function hasAddress(id: string): boolean {
  return addressIds.has(id)
}
