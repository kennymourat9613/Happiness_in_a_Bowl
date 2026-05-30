import { Order, MenuItemInfo, HistoricalDailySummary } from '../types';

export interface VendorSummaryResult {
  date: string;                       // first non-empty Date column value found
  summaries: HistoricalDailySummary[];
}

/**
 * Parse a CSV string respecting quoted fields (handles commas inside quotes).
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Split CSV text into rows, keeping newlines inside quoted fields intact.
 */
function splitCSVRows(csvText: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') i++;
      if (current.trim() !== '') rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') rows.push(current);
  return rows;
}

/**
 * Parse raw CSV text into an array of Order objects.
 */
export function parseOrders(csvText: string): Order[] {
  const lines = splitCSVRows(csvText);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const findHeader = (possible: string[]): number => {
    for (const p of possible) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const clientIdx = findHeader(['client']);
  const orderDateIdx = findHeader(['date']);
  const menuItemIdx = findHeader(['product']);
  const quantityIdx = findHeader(['quantity', 'qty', 'count']);
  const productVendorIdx = findHeader(['vendor']);
  const orderNoteIdx = findHeader(['note', 'notes']);
  const statusIdx = findHeader(['status']);

  // Accepts both the vendor export (has a Status column; only "accepted" rows count)
  // and the "Daily" source-of-truth file (Client Name, Date, Product, Quantity,
  // Vendor Name, Note — no Status, so every row counts). Vendor/Note/Date are optional.
  if (clientIdx === -1 || menuItemIdx === -1 || quantityIdx === -1) {
    throw new Error(
      'CSV headers do not match expected format. Expected at least: "client", "Product", "Quantity" (plus optional "Vendor", "Note", "Date").'
    );
  }

  const valueAt = (values: string[], idx: number): string => (idx === -1 ? '' : values[idx] || '');

  const orders: Order[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Skip rows where all relevant fields are empty (ignores data in ignored columns)
    if (
      !valueAt(values, clientIdx).trim() &&
      !valueAt(values, menuItemIdx).trim() &&
      !valueAt(values, productVendorIdx).trim() &&
      !valueAt(values, orderDateIdx).trim()
    ) continue;

    // Only include accepted orders when a status column is present
    if (statusIdx !== -1 && values[statusIdx]?.trim().toLowerCase() !== 'accepted') continue;

    const quantityStr = valueAt(values, quantityIdx).replace(/[^0-9.-]/g, '');
    const quantity = parseInt(quantityStr, 10);

    const clientFull = valueAt(values, clientIdx);
    const spaceIdx = clientFull.indexOf(' ');
    const firstName = spaceIdx !== -1 ? clientFull.slice(0, spaceIdx) : clientFull;
    const lastName = spaceIdx !== -1 ? clientFull.slice(spaceIdx + 1) : '';

    orders.push({
      firstName,
      lastName,
      orderDate: valueAt(values, orderDateIdx),
      menuItem: valueAt(values, menuItemIdx),
      quantity: isNaN(quantity) ? 1 : quantity,
      productVendor: valueAt(values, productVendorIdx),
      orderNote: valueAt(values, orderNoteIdx),
    });
  }

  return orders;
}

/**
 * Parse raw CSV text into an array of MenuItemInfo objects.
 * Expected headers: Food Items,Vendors,Price,Descriptions
 */
export function parseMenuItems(csvText: string): MenuItemInfo[] {
  const lines = splitCSVRows(csvText);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const findHeader = (possible: string[]): number => {
    for (const p of possible) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const foodItemIdx = findHeader(['food item', 'fooditem', 'food', 'item']);
  const vendorsIdx = findHeader(['vendor', 'supplier']);
  const priceIdx = findHeader(['price', 'cost', 'rate']);
  const descriptionsIdx = findHeader(['description', 'descriptions', 'desc']);

  if (foodItemIdx === -1 || priceIdx === -1) {
    throw new Error(
      'CSV headers do not match expected format. Expected at least: "Food Items" and "Price"'
    );
  }

  const menuItems: MenuItemInfo[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every((v) => v === '')) continue;

    const priceStr = values[priceIdx]?.replace(/[^0-9.-]/g, '');
    const price = parseFloat(priceStr);

    menuItems.push({
      foodItem: values[foodItemIdx] || '',
      vendor: vendorsIdx !== -1 ? values[vendorsIdx] : '',
      price: isNaN(price) ? 0 : price,
      description: descriptionsIdx !== -1 ? values[descriptionsIdx] : '',
    });
  }

  return menuItems;
}

/**
 * Parse a vendor-orders CSV export (per-order rows) into aggregated HistoricalDailySummary records.
 * Only "accepted" rows (when a status column is present) are counted.
 * Throws if the file doesn't look like a vendor-orders export.
 */
export function parseVendorOrdersAsSummary(csvText: string, sourceFile?: string): VendorSummaryResult {
  const lines = splitCSVRows(csvText);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const findHeader = (possible: string[]): number => {
    for (const p of possible) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const productIdx = findHeader(['product']);
  const quantityIdx = findHeader(['quantity', 'qty', 'count']);
  const unitPriceIdx = findHeader(['unit price', 'unitprice']);
  const totalPriceIdx = findHeader(['total price', 'totalprice', 'total']);
  const dateIdx = findHeader(['date']);
  const statusIdx = findHeader(['status']);

  // Require product, quantity, and at least one price column
  if (productIdx === -1 || quantityIdx === -1 || (unitPriceIdx === -1 && totalPriceIdx === -1)) {
    throw new Error(
      'File does not match vendor-orders format. Expected headers: "Product", "Quantity", and "Unit price" or "Total price".'
    );
  }

  // Aggregate by product (case-insensitive key, keep first-seen display casing)
  const productMap = new Map<string, { displayName: string; totalQuantity: number; subtotal: number; price: number }>();
  let firstDate = '';

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const product = values[productIdx]?.trim();
    if (!product) continue;

    // If status column exists, only accept "accepted" rows
    if (statusIdx !== -1) {
      const status = values[statusIdx]?.trim().toLowerCase();
      if (status !== 'accepted') continue;
    }

    const qtyStr = values[quantityIdx]?.replace(/[^0-9.-]/g, '');
    const qty = parseInt(qtyStr, 10);
    const quantity = isNaN(qty) ? 0 : qty;

    const unitPriceStr = unitPriceIdx !== -1 ? values[unitPriceIdx]?.replace(/[^0-9.-]/g, '') : '';
    const unitPrice = parseFloat(unitPriceStr);
    const unitPriceParsed = isNaN(unitPrice) ? 0 : unitPrice;

    const totalPriceStr = totalPriceIdx !== -1 ? values[totalPriceIdx]?.replace(/[^0-9.-]/g, '') : '';
    const totalPrice = parseFloat(totalPriceStr);
    const rowTotal = isNaN(totalPrice) ? quantity * unitPriceParsed : totalPrice;

    // Extract date from the first accepted row with a date value
    if (dateIdx !== -1 && !firstDate) {
      const d = values[dateIdx]?.trim();
      if (d) firstDate = d;
    }

    const key = product.toLowerCase();
    const existing = productMap.get(key);
    if (existing) {
      existing.totalQuantity += quantity;
      existing.subtotal += rowTotal;
      if (unitPriceParsed !== 0) existing.price = unitPriceParsed;
    } else {
      productMap.set(key, {
        displayName: product,
        totalQuantity: quantity,
        subtotal: rowTotal,
        price: unitPriceParsed,
      });
    }
  }

  const summaries: HistoricalDailySummary[] = Array.from(productMap.values()).map((entry) => ({
    menuItem: entry.displayName,
    totalQuantity: entry.totalQuantity,
    price: entry.price,
    subtotal: entry.subtotal,
    sourceFile: sourceFile,
  }));

  return { date: firstDate, summaries };
}

/**
 * Parse raw CSV text of previously exported daily summary.
 * Expected headers: Menu Item, Total Quantity, Price, Subtotal
 */
export function parseHistoricalDaily(csvText: string, sourceFile?: string): HistoricalDailySummary[] {
  const lines = splitCSVRows(csvText);

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const findHeader = (possible: string[]): number => {
    for (const p of possible) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const menuItemIdx = findHeader(['menu item', 'menuitem', 'item', 'food']);
  const quantityIdx = findHeader(['quantity', 'qty', 'total', 'count']);
  const priceIdx = findHeader(['price', 'cost']);
  const subtotalIdx = findHeader(['subtotal', 'total cost', 'totalprice', 'total_price']);

  if (menuItemIdx === -1 || quantityIdx === -1 || priceIdx === -1 || subtotalIdx === -1) {
    throw new Error(
      'Invalid daily summary format. Expected headers matching "Menu Item", "Total Quantity", "Price", and "Subtotal".'
    );
  }

  const summaries: HistoricalDailySummary[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every((v) => v === '')) continue;

    const qtyStr = values[quantityIdx]?.replace(/[^0-9.-]/g, '');
    const priceStr = values[priceIdx]?.replace(/[^0-9.-]/g, '');
    const subtotalStr = values[subtotalIdx]?.replace(/[^0-9.-]/g, '');

    const totalQuantity = parseInt(qtyStr, 10);
    const price = parseFloat(priceStr);
    const subtotal = parseFloat(subtotalStr);

    summaries.push({
      menuItem: values[menuItemIdx] || '',
      totalQuantity: isNaN(totalQuantity) ? 0 : totalQuantity,
      price: isNaN(price) ? 0 : price,
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      sourceFile: sourceFile || 'Uploaded Summary File',
    });
  }

  return summaries;
}
