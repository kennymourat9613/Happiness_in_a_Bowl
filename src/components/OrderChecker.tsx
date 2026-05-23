import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { cn } from '../utils/cn';
import { compareOrders, ComparedOrder, ComparisonResult } from '../utils/orderComparison';

/* ─── XLSX Parsers ─── */

function parseDailyXlsx(data: ArrayBuffer): ComparedOrder[] {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  if (rows.length < 2) return [];

  const headers = (rows[0] as string[]).map((h) => (h ?? '').toString().toLowerCase().trim());
  const col = (terms: string[]) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const clientIdx  = col(['client name', 'client']);
  const productIdx = col(['product']);
  const qtyIdx     = col(['quantity', 'qty']);
  const dateIdx    = col(['date']);
  const noteIdx    = col(['note']);

  const orders: ComparedOrder[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const clientName = row[clientIdx]?.toString().trim() ?? '';
    const product    = row[productIdx]?.toString().trim() ?? '';
    if (!clientName && !product) continue;

    const qtyRaw  = row[qtyIdx];
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt((qtyRaw ?? '1').toString(), 10);

    orders.push({
      clientName,
      product,
      quantity: isNaN(quantity) ? 1 : quantity,
      date:  row[dateIdx]?.toString().trim() ?? '',
      note:  row[noteIdx]?.toString().trim() ?? '',
    });
  }
  return orders;
}

function parseVendorXlsx(data: ArrayBuffer): { accepted: ComparedOrder[]; nonAccepted: ComparedOrder[] } {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  if (rows.length < 2) return { accepted: [], nonAccepted: [] };

  const headers = (rows[0] as string[]).map((h) => (h ?? '').toString().toLowerCase().trim());
  const col = (terms: string[]) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const clientIdx  = col(['client']);
  const productIdx = col(['product']);
  const qtyIdx     = col(['quantity', 'qty']);
  const dateIdx    = col(['date']);
  const noteIdx    = col(['note']);
  const statusIdx  = col(['status']);

  const accepted: ComparedOrder[]    = [];
  const nonAccepted: ComparedOrder[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];

    const rawStatus = row[statusIdx]?.toString().trim() ?? '';
    const status    = rawStatus.toLowerCase();

    // Skip rows with no status at all (blank rows / other vendors / unrelated dates)
    if (!rawStatus) continue;

    const clientName = row[clientIdx]?.toString().trim() ?? '';
    const product    = row[productIdx]?.toString().trim() ?? '';
    if (!clientName && !product) continue;

    const qtyRaw  = row[qtyIdx];
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt((qtyRaw ?? '1').toString(), 10);

    const order: ComparedOrder = {
      clientName,
      product,
      quantity: isNaN(quantity) ? 1 : quantity,
      date:   row[dateIdx]?.toString().trim() ?? '',
      note:   row[noteIdx]?.toString().trim() ?? '',
      status: rawStatus,
    };

    if (status === 'accepted') {
      accepted.push(order);
    } else {
      nonAccepted.push(order);
    }
  }

  return { accepted, nonAccepted };
}

/* ─── File Drop Zone ─── */
function DropZone({
  label,
  hint,
  fileName,
  accent,
  onFile,
}: {
  label: string;
  hint: string;
  fileName: string | null;
  accent: 'indigo' | 'emerald';
  onFile: (buf: ArrayBuffer, name: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.csv')) return;
    file.arrayBuffer().then((buf) => onFile(buf, file.name));
  };

  const borderColor  = accent === 'indigo'  ? 'border-indigo-300'  : 'border-emerald-300';
  const bgActive     = accent === 'indigo'  ? 'bg-indigo-50'       : 'bg-emerald-50';
  const textColor    = accent === 'indigo'  ? 'text-indigo-700'    : 'text-emerald-700';
  const badgeBg      = accent === 'indigo'  ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800';

  return (
    <div
      className={cn(
        'relative flex-1 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
        dragging ? `${borderColor} ${bgActive} scale-[1.01]` : 'border-slate-200 hover:border-slate-300 bg-white',
      )}
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', badgeBg)}>✓ Loaded</span>
          <p className={cn('text-sm font-semibold', textColor)}>{fileName}</p>
          <p className="text-xs text-slate-400">Click to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="text-2xl">📂</div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="text-xs text-slate-400">{hint}</p>
          <p className="text-xs text-slate-300 mt-1">.xlsx or .csv</p>
        </div>
      )}
    </div>
  );
}

/* ─── Result Table ─── */
type RowKind = 'matched' | 'missing' | 'extra' | 'not_accepted';

interface FlatRow {
  kind: RowKind;
  clientName: string;
  product: string;
  quantity: number;
  dailyDate: string;
  vendorDate: string;
  dailyNote: string;
  vendorNote: string;
  vendorStatus?: string;
}

function buildFlatRows(result: ComparisonResult): FlatRow[] {
  const rows: FlatRow[] = [];

  for (const { daily, vendor } of result.matched) {
    rows.push({
      kind: 'matched',
      clientName: daily.clientName,
      product: daily.product,
      quantity: daily.quantity,
      dailyDate: daily.date,
      vendorDate: vendor.date,
      dailyNote: daily.note,
      vendorNote: vendor.note,
    });
  }
  for (const { daily, vendor } of result.notAcceptedInVendor) {
    rows.push({
      kind: 'not_accepted',
      clientName: daily.clientName,
      product: daily.product,
      quantity: daily.quantity,
      dailyDate: daily.date,
      vendorDate: vendor.date,
      dailyNote: daily.note,
      vendorNote: vendor.note,
      vendorStatus: vendor.status,
    });
  }
  for (const o of result.missingFromVendor) {
    rows.push({
      kind: 'missing',
      clientName: o.clientName,
      product: o.product,
      quantity: o.quantity,
      dailyDate: o.date,
      vendorDate: '',
      dailyNote: o.note,
      vendorNote: '',
    });
  }
  for (const o of result.extraInVendor) {
    rows.push({
      kind: 'extra',
      clientName: o.clientName,
      product: o.product,
      quantity: o.quantity,
      dailyDate: '',
      vendorDate: o.date,
      dailyNote: '',
      vendorNote: o.note,
      vendorStatus: o.status,
    });
  }

  // Sort: not_accepted first, missing, extra, matched last
  const order: Record<RowKind, number> = { not_accepted: 0, missing: 1, extra: 2, matched: 3 };
  rows.sort((a, b) => order[a.kind] - order[b.kind] || a.clientName.localeCompare(b.clientName));

  return rows;
}

const ROW_STYLE: Record<RowKind, string> = {
  matched:      'bg-emerald-50/60 border-emerald-100',
  missing:      'bg-red-50/70     border-red-100',
  extra:        'bg-amber-50/70   border-amber-100',
  not_accepted: 'bg-orange-50/80  border-orange-100',
};

const BADGE: Record<RowKind, string> = {
  matched:      'bg-emerald-100 text-emerald-800',
  missing:      'bg-red-100     text-red-800',
  extra:        'bg-amber-100   text-amber-800',
  not_accepted: 'bg-orange-100  text-orange-800',
};

const LABEL: Record<RowKind, string> = {
  matched:      '✓ Matched',
  missing:      '✗ Missing from vendor',
  extra:        '+ Extra in vendor',
  not_accepted: '⚠ Not accepted',
};

type FilterTab = 'all' | RowKind;

/* ─── Main Component ─── */
export default function OrderChecker() {
  const [dailyOrders,       setDailyOrders]       = useState<ComparedOrder[] | null>(null);
  const [vendorAccepted,    setVendorAccepted]    = useState<ComparedOrder[] | null>(null);
  const [vendorNonAccepted, setVendorNonAccepted] = useState<ComparedOrder[] | null>(null);
  const [dailyName,         setDailyName]         = useState<string | null>(null);
  const [vendorName,        setVendorName]         = useState<string | null>(null);
  const [filter, setFilter]                        = useState<FilterTab>('all');
  const [search, setSearch]                        = useState('');

  const handleDailyFile  = (buf: ArrayBuffer, name: string) => {
    setDailyOrders(parseDailyXlsx(buf));
    setDailyName(name);
  };
  const handleVendorFile = (buf: ArrayBuffer, name: string) => {
    const { accepted, nonAccepted } = parseVendorXlsx(buf);
    setVendorAccepted(accepted);
    setVendorNonAccepted(nonAccepted);
    setVendorName(name);
  };

  const result = useMemo<ComparisonResult | null>(() => {
    if (!dailyOrders || !vendorAccepted || !vendorNonAccepted) return null;
    return compareOrders(dailyOrders, vendorAccepted, vendorNonAccepted);
  }, [dailyOrders, vendorAccepted, vendorNonAccepted]);

  const allRows = useMemo(() => (result ? buildFlatRows(result) : []), [result]);

  const visibleRows = useMemo(() => {
    let rows = filter === 'all' ? allRows : allRows.filter((r) => r.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.clientName.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, filter, search]);

  const counts = useMemo(() => ({
    matched:      result?.matched.length ?? 0,
    notAccepted:  result?.notAcceptedInVendor.length ?? 0,
    missing:      result?.missingFromVendor.length ?? 0,
    extra:        result?.extraInVendor.length ?? 0,
  }), [result]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Order Checker</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload both files to compare orders. The <span className="font-semibold text-indigo-700">Daily file</span> is the source of truth.
        </p>
      </div>

      {/* Upload Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <DropZone
          label="Daily File (Source of Truth)"
          hint="Happiness_in_a_Bowl_daily_*.xlsx"
          fileName={dailyName}
          accent="indigo"
          onFile={handleDailyFile}
        />
        <div className="flex items-center justify-center text-slate-300 font-bold text-lg select-none">VS</div>
        <DropZone
          label="Vendor Export"
          hint="export-*-vendor-orders.xlsx / .csv"
          fileName={vendorName}
          accent="emerald"
          onFile={handleVendorFile}
        />
      </div>

      {/* Waiting state */}
      {!result && (
        <div className="text-center py-12 text-slate-400 text-sm">
          {!dailyOrders && !vendorAccepted
            ? 'Upload both files to start the comparison.'
            : !dailyOrders
            ? 'Waiting for the Daily (source of truth) file…'
            : 'Waiting for the Vendor Export file…'}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              <span className="text-emerald-600 font-bold text-lg">{counts.matched}</span>
              <span className="text-sm text-emerald-700 font-medium">Matched</span>
            </div>
            {counts.notAccepted > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                <span className="text-orange-600 font-bold text-lg">{counts.notAccepted}</span>
                <span className="text-sm text-orange-700 font-medium">Not accepted in vendor</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <span className="text-red-600 font-bold text-lg">{counts.missing}</span>
              <span className="text-sm text-red-700 font-medium">Missing from vendor</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <span className="text-amber-600 font-bold text-lg">{counts.extra}</span>
              <span className="text-sm text-amber-700 font-medium">Extra in vendor</span>
            </div>
          </div>

          {/* Filter tabs + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 self-start">
              {(['all', 'not_accepted', 'missing', 'extra', 'matched'] as FilterTab[]).map((tab) => {
                if (tab === 'not_accepted' && counts.notAccepted === 0) return null;
                return (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                      filter === tab
                        ? 'bg-white shadow text-slate-800'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {tab === 'all'          ? `All (${allRows.length})`
                    : tab === 'not_accepted' ? `Not accepted (${counts.notAccepted})`
                    : tab === 'missing'      ? `Missing (${counts.missing})`
                    : tab === 'extra'        ? `Extra (${counts.extra})`
                    :                          `Matched (${counts.matched})`}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search by client or product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                      No rows match your filter.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={cn('border-b last:border-0', ROW_STYLE[row.kind])}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap', BADGE[row.kind])}>
                          {LABEL[row.kind]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.clientName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.product}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">{row.quantity}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{row.dailyDate || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{row.vendorDate || '—'}</td>
                      <td className="px-4 py-3 text-xs max-w-xs">
                        {row.kind === 'not_accepted' ? (
                          <span className="text-orange-700 font-medium">
                            Vendor status: {row.vendorStatus}
                            {(row.dailyNote || row.vendorNote) && (
                              <span className="block text-slate-400 font-normal truncate">
                                {row.dailyNote || row.vendorNote}
                              </span>
                            )}
                          </span>
                        ) : row.kind === 'extra' && row.vendorStatus && row.vendorStatus.toLowerCase() !== 'accepted' ? (
                          <span className="text-orange-700 font-medium">
                            Vendor status: {row.vendorStatus}
                            {row.vendorNote && (
                              <span className="block text-slate-400 font-normal truncate">
                                {row.vendorNote}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500 truncate block">
                            {row.dailyNote || row.vendorNote || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-400"></span>
              Matched — accepted in vendor and present in daily
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-400"></span>
              Not accepted — in daily but vendor status is not accepted (e.g. cancelled)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-red-400"></span>
              Missing — in daily record but no trace in vendor export
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-400"></span>
              Extra — accepted in vendor export but not in daily record
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
