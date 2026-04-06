export interface InvoiceData {
  email?: string
  buyerTaxNo?: string
  invoiceType?: number | null
  buyerPhone?: string
  buyerName?: string
  titleType?: string | number
  contentType?: string | number
}

export interface StoreInfoItem {
  storeId: string
  storeName: string
  remark?: string
}

export function handleInvoice(invoiceData: InvoiceData) {
  if (!invoiceData || invoiceData.invoiceType == 0) {
    return '暂不开发票'
  }
  const title = invoiceData.titleType == 2 ? '公司' : '个人'
  const content = invoiceData.contentType == 2 ? '商品类别' : '商品明细'
  return invoiceData.email
    ? `电子普通发票 (${content} - ${title})`
    : '暂不开发票'
}

export function getNotes(storeInfoList: StoreInfoItem[] | undefined, storeIndex: number) {
  if (!storeInfoList) {
    return ''
  }
  const storeInfo = storeInfoList[storeIndex]
  if (!storeInfo) {
    return ''
  }
  return storeInfo.remark
}
