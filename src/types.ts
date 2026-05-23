export interface Order {
  firstName: string;
  lastName: string;
  orderDate: string;
  menuItem: string;
  quantity: number;
  productVendor: string;
  orderNote: string;
}

export interface GroupedOrder {
  menuItem: string;
  totalQuantity: number;
  orders: Order[];
}

export interface MenuItemInfo {
  foodItem: string;
  vendor: string;
  price: number;
  description: string;
}

export interface SavedDailyItem {
  menuItem: string;
  totalQuantity: number;
  price: number;
  subtotal: number;
}

export interface SavedDailyTotal {
  id: string;
  date: string;
  batchName: string;
  totalQuantity: number;
  totalCost: number;
  items?: SavedDailyItem[];
}

export interface HistoricalDailySummary {
  menuItem: string;
  totalQuantity: number;
  price: number;
  subtotal: number;
  sourceFile?: string;
}

export interface SavedSummaryUpload {
  id: string;
  name: string;          // editable display name; default `orders(<date>)`
  date: string;          // extracted date (vendor: from Date column; daily-summary: from filename if present, else '')
  uploadedAt: number;
  format: 'vendor-orders' | 'daily-summary';
  signature: string;     // content hash for duplicate detection
  summaries: HistoricalDailySummary[];
}
