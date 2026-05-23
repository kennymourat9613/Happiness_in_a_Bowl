export interface ComparedOrder {
  clientName: string;
  product: string;
  quantity: number;
  date: string;
  note: string;
  status?: string; // only populated for vendor orders with a non-accepted status
}

export interface ComparisonResult {
  matched: Array<{ daily: ComparedOrder; vendor: ComparedOrder }>;
  notAcceptedInVendor: Array<{ daily: ComparedOrder; vendor: ComparedOrder }>; // in daily, found in vendor but status is not accepted
  missingFromVendor: ComparedOrder[];  // in daily but no trace in vendor at all
  extraInVendor: ComparedOrder[];      // accepted in vendor but not in daily
}

const makeKey = (o: ComparedOrder) =>
  `${o.clientName.trim().toLowerCase()}|${o.product.trim().toLowerCase()}|${o.quantity}`;

export function compareOrders(
  daily: ComparedOrder[],
  vendorAccepted: ComparedOrder[],
  vendorNonAccepted: ComparedOrder[],
): ComparisonResult {
  // Build bags so duplicates are consumed one-by-one
  const acceptedBag = new Map<string, ComparedOrder[]>();
  for (const o of vendorAccepted) {
    const k = makeKey(o);
    if (!acceptedBag.has(k)) acceptedBag.set(k, []);
    acceptedBag.get(k)!.push(o);
  }

  const nonAcceptedBag = new Map<string, ComparedOrder[]>();
  for (const o of vendorNonAccepted) {
    const k = makeKey(o);
    if (!nonAcceptedBag.has(k)) nonAcceptedBag.set(k, []);
    nonAcceptedBag.get(k)!.push(o);
  }

  const matched: ComparisonResult['matched'] = [];
  const notAcceptedInVendor: ComparisonResult['notAcceptedInVendor'] = [];
  const missingFromVendor: ComparedOrder[] = [];

  for (const d of daily) {
    const k = makeKey(d);

    const acceptedBucket = acceptedBag.get(k);
    if (acceptedBucket && acceptedBucket.length > 0) {
      matched.push({ daily: d, vendor: acceptedBucket.shift()! });
      continue;
    }

    const nonAcceptedBucket = nonAcceptedBag.get(k);
    if (nonAcceptedBucket && nonAcceptedBucket.length > 0) {
      notAcceptedInVendor.push({ daily: d, vendor: nonAcceptedBucket.shift()! });
      continue;
    }

    missingFromVendor.push(d);
  }

  // Vendor orders that had no daily match — both accepted and non-accepted leftovers
  const extraInVendor: ComparedOrder[] = [];
  for (const bucket of acceptedBag.values()) {
    extraInVendor.push(...bucket);
  }
  for (const bucket of nonAcceptedBag.values()) {
    extraInVendor.push(...bucket);
  }

  return { matched, notAcceptedInVendor, missingFromVendor, extraInVendor };
}
