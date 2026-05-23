import { useState, useCallback, useMemo, useRef, useEffect, Fragment } from 'react';
import { Order, GroupedOrder, MenuItemInfo, SavedDailyTotal, HistoricalDailySummary, SavedSummaryUpload } from './types';
import { parseOrders, parseMenuItems, parseHistoricalDaily, parseVendorOrdersAsSummary } from './utils/csvParser';
import { cn } from './utils/cn';
import * as XLSX from 'xlsx';
import OrderChecker from './components/OrderChecker';
import { supabase } from './lib/supabase';
import { getItem, setItem, removeItem } from './lib/storage';

/* ─── Icons ─── */
function UploadIcon() {
  return (
    <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function ChefIcon() {
  return (
    <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.5 0-2.5.5-3 1.5C8 5 7 6.5 7 8a5 5 0 0 0 10 0c0-1.5-1-3-2-3.5-.5-1-1.5-1.5-3-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 13h12l.5 3.5a3 3 0 0 1-3 3.5h-7a3 3 0 0 1-3-3.5L6 13Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}



function TagIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 4.5 1.016c.55.623 1.354 1.016 2.25 1.016a3.001 3.001 0 0 0 3.75-.615m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-2.25 6a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92ZM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1Z" clipRule="evenodd" />
    </svg>
  );
}

/* ─── Utility ─── */
function groupOrdersByMenuItem(orders: Order[]): GroupedOrder[] {
  const map = new Map<string, Order[]>();
  for (const order of orders) {
    const key = order.menuItem.trim().toLowerCase();
    const displayKey = order.menuItem.trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ ...order, menuItem: displayKey });
  }

  return Array.from(map.entries()).map(([, orders]) => ({
    menuItem: orders[0].menuItem,
    totalQuantity: orders.reduce((sum, o) => sum + o.quantity, 0),
    orders,
  }));
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

/* ─── Order Row ─── */
function OrderRow({ order, index }: { order: Order; index: number }) {
  return (
    <tr className={cn(
      "transition-colors hover:bg-slate-50/80",
      index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
    )}>
      <td className="px-4 py-3 text-sm font-medium text-slate-900">
        {order.firstName} {order.lastName}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-semibold rounded-full px-2.5 py-0.5 text-xs">
          {order.quantity}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
          {order.productVendor || <span className="text-slate-400 italic">N/A</span>}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {order.orderDate || <span className="text-slate-400 italic">—</span>}
      </td>
      <td className="px-4 py-3 text-sm max-w-xs">
        {order.orderNote ? (
          <div className="flex items-start gap-2">
            <NoteIcon />
            <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg text-xs leading-relaxed">
              {order.orderNote}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 italic">No notes</span>
        )}
      </td>
    </tr>
  );
}

/* ─── Order Group Card ─── */
function OrderGroupCard({ group, menuItemInfo }: { group: GroupedOrder; menuItemInfo?: MenuItemInfo }) {
  const [expanded, setExpanded] = useState(true);

  const hasNotes = group.orders.some((o) => o.orderNote.trim() !== '');
  const subtotal = menuItemInfo ? group.totalQuantity * menuItemInfo.price : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
            <span className="text-white text-lg">🍽️</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{group.menuItem}</h3>
            <p className="text-xs text-slate-500">
              {group.orders.length} order{group.orders.length !== 1 ? 's' : ''}
              {hasNotes && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <NoteIcon /> Has special notes
                </span>
              )}
            </p>
            {menuItemInfo && menuItemInfo.description && (
              <p className="text-xs text-slate-400 italic mt-1 line-clamp-1 max-w-md">
                "{menuItemInfo.description}"
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {menuItemInfo && (
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block font-medium">Price: Rs. {menuItemInfo.price.toFixed(2)} ea</span>
              <span className="text-sm font-semibold text-indigo-600">Subtotal: Rs. {subtotal?.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 rounded-xl border border-emerald-100">
              <PackageIcon />
              <span className="text-emerald-700 font-bold text-lg">{group.totalQuantity}</span>
              <span className="text-emerald-600 text-xs font-medium">total</span>
            </div>
            <svg
              className={cn("h-5 w-5 text-slate-400 transition-transform duration-300", expanded && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </button>

      {/* Table */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    👤 Deliver To
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    🏢 Vendor
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    📅 Order Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    📝 Special Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.orders.map((order, idx) => (
                  <OrderRow key={idx} order={order} index={idx} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Upload Area ─── */
function UploadArea({ onFileSelect, error }: {
  onFileSelect: (text: string) => void;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        onFileSelect(csv);
      };
      reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFileSelect(text);
      };
      reader.readAsText(file);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [onFileSelect]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  return (
    <div className="max-w-2xl mx-auto">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300",
          dragging
            ? "border-indigo-400 bg-indigo-50/50 scale-[1.01]"
            : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "h-20 w-20 rounded-2xl flex items-center justify-center transition-all duration-300",
            dragging ? "bg-indigo-100" : "bg-slate-100"
          )}>
            <UploadIcon />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-700">
              {dragging ? 'Drop your file here' : 'Upload your catering orders'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Drag & drop a <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">.csv</code> or <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">.xlsx</code> file, or click to browse
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <FileIcon />
            <span className="text-xs text-slate-400">Expected: First Name, Last Name, Order Date, Menu Item, Quantity, Product Vendor, Order Note</span>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-700">Upload Error</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Demo info */}
      <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
        <p className="text-xs text-slate-500 font-medium mb-2">📋 Sample CSV format:</p>
        <pre className="text-[11px] text-slate-400 font-mono overflow-x-auto leading-relaxed">
{`"First Name","Last Name","Order Date","Menu Item",Quantity,"Product Vendor","Order Note"
"John","Smith","2024-03-15","Chicken Biryani",2,"Tasty Foods","Extra spicy"
"Jane","Doe","2024-03-15","Veggie Wrap",1,"Green Kitchen","No onions, please"
"John","Smith","2024-03-15","Veggie Wrap",1,"Green Kitchen",""`}
        </pre>
      </div>
    </div>
  );
}

/* ─── Sort Type ─── */
type SortType = 'name-asc' | 'name-desc' | 'qty-desc' | 'qty-asc' | 'orders-desc' | 'orders-asc';

/* ─── Main App ─── */
export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemInfo[]>([]);
  const [savedTotals, setSavedTotals] = useState<SavedDailyTotal[]>([]);
  const [savedUploads, setSavedUploads] = useState<SavedSummaryUpload[]>([]);
  
  const [activeTab, setActiveTab] = useState<'active' | 'historical' | 'checker'>('active');
  const [error, setError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('qty-desc');
  const [fileName, setFileName] = useState('');
  const [menuFileName, setMenuFileName] = useState('');
  const [menuUploadTimestamp, setMenuUploadTimestamp] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Load saved data from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const saved = await getItem('catering_saved_totals');
        if (saved) setSavedTotals(saved as SavedDailyTotal[]);
      } catch (e) {
        console.error('Failed to load saved totals', e);
      }

      try {
        const savedUploadsRaw = await getItem('catering_summary_uploads');
        if (savedUploadsRaw) setSavedUploads(savedUploadsRaw as SavedSummaryUpload[]);
      } catch (e) {
        console.error('Failed to load saved uploads', e);
      }

      try {
        const savedMenu = await getItem('catering_menu_items');
        const savedMenuName = await getItem('catering_menu_filename');
        const savedMenuTime = await getItem('catering_menu_upload_timestamp');

        if (savedMenu && savedMenuName && savedMenuTime) {
          const timestamp = savedMenuTime as number;
          const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;

          if (Date.now() - timestamp > threeMonthsMs) {
            console.warn('Catering Menu Prices are older than 3 months. Recommended to update.');
          }

          setMenuItems(savedMenu as MenuItemInfo[]);
          setMenuFileName(savedMenuName as string);
          setMenuUploadTimestamp(timestamp);
        }
      } catch (e) {
        console.error('Failed to load menu from storage', e);
      }

      // Recover active orders if they refreshed/scrolled on their tablet accidentally
      try {
        const savedActiveOrders = await getItem('catering_active_orders');
        const savedActiveFilename = await getItem('catering_active_filename');
        if (savedActiveOrders && savedActiveFilename) {
          setOrders(savedActiveOrders as Order[]);
          setFileName(savedActiveFilename as string);
        }
      } catch (e) {
        console.error('Failed to restore active orders', e);
      }
    }

    void load();
  }, []);

  const handleFile = useCallback((text: string) => {
    try {
      const parsed = parseOrders(text);
      setOrders(parsed);
      setError(null);
      setFileName('orders.csv');

      // Save active batch so tablet users don't lose progress on pull-to-refresh
      void setItem('catering_active_orders', parsed);
      void setItem('catering_active_filename', 'orders.csv');
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    }
  }, []);

  const handleMenuFile = useCallback((text: string, name: string) => {
    try {
      const parsed = parseMenuItems(text);
      const timestamp = Date.now();

      setMenuItems(parsed);
      setMenuError(null);
      setMenuFileName(name);
      setMenuUploadTimestamp(timestamp);

      void setItem('catering_menu_items', parsed);
      void setItem('catering_menu_filename', name);
      void setItem('catering_menu_upload_timestamp', timestamp);
    } catch (e) {
      setMenuError((e as Error).message);
      setMenuItems([]);
    }
  }, []);

  const handleClearMenu = useCallback(() => {
    setMenuItems([]);
    setMenuFileName('');
    setMenuUploadTimestamp(null);
    void removeItem('catering_menu_items');
    void removeItem('catering_menu_filename');
    void removeItem('catering_menu_upload_timestamp');
  }, []);

  // Persist savedUploads to state + Supabase
  const persistUploads = useCallback((next: SavedSummaryUpload[]) => {
    setSavedUploads(next);
    void setItem('catering_summary_uploads', next);
  }, []);

  // Compute a content-based signature for dedup
  const computeSignature = useCallback((summaries: HistoricalDailySummary[]): string => {
    return summaries
      .map((s) => `${s.menuItem.trim().toLowerCase()}|${s.totalQuantity}|${s.subtotal}`)
      .sort()
      .join('#');
  }, []);

  // New upload handler supporting both vendor-orders and daily-summary formats
  const handleSummaryUpload = useCallback((text: string, fileName: string) => {
    let summaries: HistoricalDailySummary[];
    let date: string;
    let format: 'vendor-orders' | 'daily-summary';

    try {
      const result = parseVendorOrdersAsSummary(text, fileName);
      summaries = result.summaries;
      date = result.date;
      format = 'vendor-orders';
    } catch {
      try {
        summaries = parseHistoricalDaily(text, fileName);
        date = fileName.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
        format = 'daily-summary';
      } catch (e2) {
        setHistoricalError((e2 as Error).message);
        return;
      }
    }

    const signature = computeSignature(summaries);

    setSavedUploads((prevUploads) => {
      if (prevUploads.some((u) => u.signature === signature)) {
        setHistoricalError(`Duplicate: This file's data is already saved (matching upload found). No changes made.`);
        return prevUploads;
      }

      // Build default name
      const baseName = date ? `orders(${date})` : `orders(${fileName.replace(/\.[^.]+$/, '')})`;
      let candidateName = baseName;
      let suffix = 2;
      while (prevUploads.some((u) => u.name === candidateName)) {
        candidateName = `${baseName} (${suffix})`;
        suffix++;
      }

      const newUpload: SavedSummaryUpload = {
        id: Math.random().toString(36).slice(2, 9),
        name: candidateName,
        date,
        uploadedAt: Date.now(),
        format,
        signature,
        summaries,
      };

      const next = [newUpload, ...prevUploads];
      void setItem('catering_summary_uploads', next);
      setHistoricalError(null);
      return next;
    });
  }, [computeSignature]);

  // Rename an upload
  const handleRenameUpload = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSavedUploads((prev) => {
      const next = prev.map((u) => u.id === id ? { ...u, name: trimmed } : u);
      void setItem('catering_summary_uploads', next);
      return next;
    });
  }, []);

  // Delete an upload
  const handleDeleteUpload = useCallback((id: string) => {
    setSavedUploads((prev) => {
      const next = prev.filter((u) => u.id !== id);
      void setItem('catering_summary_uploads', next);
      return next;
    });
  }, []);

  // Derive flat list of summaries from savedUploads (keeps existing downstream memos working)
  const historicalSummaries = useMemo<HistoricalDailySummary[]>(
    () => savedUploads.flatMap((u) => u.summaries),
    [savedUploads]
  );

  const menuDaysLeft = useMemo(() => {
    if (!menuUploadTimestamp) return null;
    const daysUsed = Math.floor((Date.now() - menuUploadTimestamp) / (24 * 60 * 60 * 1000));
    return Math.max(0, 90 - daysUsed);
  }, [menuUploadTimestamp]);

  const grouped = useMemo(() => groupOrdersByMenuItem(orders), [orders]);

  const filtered = useMemo(() => {
    let result = grouped;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.menuItem.toLowerCase().includes(q) ||
          g.orders.some(
            (o) =>
              o.firstName.toLowerCase().includes(q) ||
              o.lastName.toLowerCase().includes(q) ||
              o.productVendor.toLowerCase().includes(q) ||
              o.orderNote.toLowerCase().includes(q)
          )
      );
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'name-asc': return a.menuItem.localeCompare(b.menuItem);
        case 'name-desc': return b.menuItem.localeCompare(a.menuItem);
        case 'qty-desc': return b.totalQuantity - a.totalQuantity;
        case 'qty-asc': return a.totalQuantity - b.totalQuantity;
        case 'orders-desc': return b.orders.length - a.orders.length;
        case 'orders-asc': return a.orders.length - b.orders.length;
        default: return 0;
      }
    });

    return result;
  }, [grouped, search, sort]);

  const totalItems = orders.reduce((s, o) => s + o.quantity, 0);
  const uniqueVendors = new Set(orders.map((o) => o.productVendor.toLowerCase())).size;

  // Find price and info matching a food item name (case-insensitive)
  const getMenuItemInfo = useCallback((foodName: string): MenuItemInfo | undefined => {
    const clean = foodName.trim().toLowerCase();
    return menuItems.find((m) => m.foodItem.trim().toLowerCase() === clean);
  }, [menuItems]);

  // Calculate the active batch total cost
  const activeBatchTotalCost = useMemo(() => {
    return grouped.reduce((total, group) => {
      const match = getMenuItemInfo(group.menuItem);
      const price = match ? match.price : 0;
      return total + (group.totalQuantity * price);
    }, 0);
  }, [grouped, getMenuItemInfo]);

  // Save Daily Total to shared database
  const handleSaveDailyTotal = useCallback(() => {
    if (orders.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    
    const items = grouped.map((group) => {
      const match = getMenuItemInfo(group.menuItem);
      const price = match ? match.price : 0;
      return {
        menuItem: group.menuItem,
        totalQuantity: group.totalQuantity,
        price,
        subtotal: group.totalQuantity * price,
      };
    });

    const newTotal: SavedDailyTotal = {
      id: Math.random().toString(36).substring(2, 9),
      date: today,
      batchName: fileName || 'Catering Batch',
      totalQuantity: totalItems,
      totalCost: activeBatchTotalCost,
      items,
    };
    const updated = [newTotal, ...savedTotals];
    setSavedTotals(updated);
    void setItem('catering_saved_totals', updated);
    alert('Daily order summary saved to the shared database successfully!');
  }, [orders, fileName, totalItems, activeBatchTotalCost, savedTotals]);

  // Delete saved total
  const handleDeleteSavedTotal = useCallback((id: string) => {
    const updated = savedTotals.filter((t) => t.id !== id);
    setSavedTotals(updated);
    void setItem('catering_saved_totals', updated);
  }, [savedTotals]);

  // Export Daily Summary CSV
  const handleExportDailyCSV = useCallback(() => {
    if (grouped.length === 0) return;

    let csvContent = '"Menu Item","Total Quantity","Price","Subtotal"\r\n';
    for (const group of grouped) {
      const info = getMenuItemInfo(group.menuItem);
      const price = info ? info.price : 0;
      const subtotal = group.totalQuantity * price;
      
      // Clean menu item to handle quotes or commas safely
      const cleanMenuItem = group.menuItem.replace(/"/g, '""');
      csvContent += `"${cleanMenuItem}",${group.totalQuantity},${price},${subtotal}\r\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `daily_summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [grouped, getMenuItemInfo]);

  // Historical calculations
  const cumulativeHistoricalCost = useMemo(() => {
    return historicalSummaries.reduce((sum, item) => sum + item.subtotal, 0);
  }, [historicalSummaries]);

  const cumulativeHistoricalQuantity = useMemo(() => {
    return historicalSummaries.reduce((sum, item) => sum + item.totalQuantity, 0);
  }, [historicalSummaries]);

  // Group historical and saved item costs for subcategory breakdown with detailed occurrences
  const cumulativeBreakdown = useMemo(() => {
    interface Occurrence {
      date: string;
      source: string;
      quantity: number;
      subtotal: number;
    }

    const map = new Map<string, { displayName: string; totalQty: number; totalCost: number; occurrences: Occurrence[] }>();

    // 1. Process uploaded historical files (grouped by upload so we use the upload's date/name)
    for (const upload of savedUploads) {
      for (const item of upload.summaries) {
        const clean = item.menuItem.trim().toLowerCase();
        const display = item.menuItem.trim();
        const current = map.get(clean) || { displayName: display, totalQty: 0, totalCost: 0, occurrences: [] };

        const dateStr = upload.date || new Date().toISOString().slice(0, 10);

        current.occurrences.push({
          date: dateStr,
          source: upload.name,
          quantity: item.totalQuantity,
          subtotal: item.subtotal,
        });

        map.set(clean, {
          displayName: current.displayName,
          totalQty: current.totalQty + item.totalQuantity,
          totalCost: current.totalCost + item.subtotal,
          occurrences: current.occurrences,
        });
      }
    }

    // 2. Process locally saved PC records
    for (const total of savedTotals) {
      if (total.items) {
        for (const item of total.items) {
          const clean = item.menuItem.trim().toLowerCase();
          const display = item.menuItem.trim();
          const current = map.get(clean) || { displayName: display, totalQty: 0, totalCost: 0, occurrences: [] };

          current.occurrences.push({
            date: total.date,
            source: `Saved Record: ${total.batchName}`,
            quantity: item.totalQuantity,
            subtotal: item.subtotal,
          });

          map.set(clean, {
            displayName: current.displayName,
            totalQty: current.totalQty + item.totalQuantity,
            totalCost: current.totalCost + item.subtotal,
            occurrences: current.occurrences,
          });
        }
      }
    }

    return Array.from(map.entries()).map(([key, value]) => ({
      name: key,
      displayName: value.displayName,
      totalQty: value.totalQty,
      totalCost: value.totalCost,
      occurrences: value.occurrences,
    }));
  }, [savedUploads, savedTotals]);

  const handlePrint = () => window.print();

  const handleReset = () => {
    setOrders([]);
    setFileName('');
    setSearch('');
    setError(null);
    void removeItem('catering_active_orders');
    void removeItem('catering_active_filename');
  };

  const handleResetHistorical = () => {
    persistUploads([]);
    setHistoricalError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Print styles & overscroll behavior mitigation */}
      <style>{`
        html, body {
          overscroll-behavior-y: contain;
        }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-break-inside { break-inside: avoid; }
          h1 { font-size: 18pt !important; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <ChefIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Catering Order Manager</h1>
              <p className="text-xs text-slate-500">Upload • Organize • Fulfill</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold transition-colors"
            >
              📖 User Guide
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Sign out
            </button>
            {orders.length > 0 && (
              <>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <PrintIcon /> Print
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <XIcon /> Reset
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="no-print bg-slate-100/50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
              activeTab === 'active'
                ? "border-indigo-600 text-indigo-700 bg-white/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            📋 Active Batch Processor
          </button>
          <button
            onClick={() => setActiveTab('historical')}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
              activeTab === 'historical'
                ? "border-indigo-600 text-indigo-700 bg-white/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            📊 Total Cost Calculator
          </button>
          <button
            onClick={() => setActiveTab('checker')}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
              activeTab === 'checker'
                ? "border-indigo-600 text-indigo-700 bg-white/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            🔍 Order Checker
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'active' ? (
          orders.length === 0 ? (
            /* Upload View */
            <div className="py-12 space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Manage Your Catering Orders</h2>
                <p className="text-slate-500 mt-2 max-w-md mx-auto">
                  Upload your orders CSV file to view orders grouped by menu item, with totals, delivery info, and special notes.
                </p>
              </div>
              <UploadArea onFileSelect={handleFile} error={error} />
            </div>
          ) : (
            /* Orders View */
            <div className="space-y-6">
              {/* File info banner */}
              <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
                  <div className="flex items-center gap-3 text-sm text-indigo-700">
                    <FileIcon />
                    <div>
                      <p className="font-semibold">Loaded Orders CSV</p>
                      <p className="text-xs text-indigo-500 mt-0.5">{fileName} ({orders.length} orders)</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Change file
                  </button>
                </div>

                 {/* Secondary upload - Menu Items and Prices */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-emerald-100 text-emerald-800 p-2 rounded-xl">
                      💲
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {menuItems.length > 0 ? 'Loaded Menu Prices CSV' : 'Import Menu Prices CSV'}
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {menuItems.length > 0 ? (
                          <>
                            <strong>{menuFileName}</strong> ({menuItems.length} items)
                            {menuDaysLeft !== null && (
                              <span className="block mt-0.5 font-medium text-emerald-700">
                                📅 Stored in database. {menuDaysLeft > 0 ? `Expires in ${menuDaysLeft} days` : 'Expired (older than 3 months)'}
                              </span>
                            )}
                          </>
                        ) : (
                          'Unlock subtotal calculations and batch total costs'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {menuItems.length > 0 && (
                      <button
                        onClick={handleClearMenu}
                        className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
                      >
                        Reset Menu
                      </button>
                    )}
                    <label className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm">
                      {menuItems.length > 0 ? 'Change Menu' : 'Upload Menu'}
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const text = evt.target?.result as string;
                              handleMenuFile(text, file.name);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {menuError && (
                <div className="no-print p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
                  ⚠️ <strong>Menu Error:</strong> {menuError}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={<ClipboardIcon />} label="Total Orders" value={orders.length} color="bg-blue-50 text-blue-600" />
                <StatCard icon={<TagIcon />} label="Unique Menu Items" value={grouped.length} color="bg-emerald-50 text-emerald-600" />
                <StatCard icon={<PackageIcon />} label="Total Items to Prepare" value={totalItems} color="bg-violet-50 text-violet-600" />
                <StatCard icon={<BuildingIcon />} label="Vendors" value={uniqueVendors} color="bg-amber-50 text-amber-600" />
                <StatCard
                  icon={<span className="text-xl font-bold">💲</span>}
                  label="Batch Total Cost"
                  value={menuItems.length > 0 ? `Rs. ${activeBatchTotalCost.toFixed(2)}` : 'Upload Prices'}
                  color="bg-teal-50 text-teal-600"
                />
              </div>

              {/* Controls */}
              <div className="no-print flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by menu item, person, vendor, or notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <XIcon />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SortIcon />
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortType)}
                    className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all appearance-none cursor-pointer"
                  >
                    <option value="qty-desc">Sort: Qty (High → Low)</option>
                    <option value="qty-asc">Sort: Qty (Low → High)</option>
                    <option value="name-asc">Sort: Name (A → Z)</option>
                    <option value="name-desc">Sort: Name (Z → A)</option>
                    <option value="orders-desc">Sort: Orders (Most → Least)</option>
                    <option value="orders-asc">Sort: Orders (Least → Most)</option>
                  </select>
                </div>
              </div>

              {/* Results count */}
              {search && (
                <p className="text-sm text-slate-500">
                  Showing <strong>{filtered.length}</strong> of <strong>{grouped.length}</strong> menu item{grouped.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Order Groups */}
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <SearchIcon />
                  </div>
                  <p className="text-slate-500 font-medium">No matching orders found</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your search term</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map((group, idx) => (
                    <div key={`${group.menuItem}-${idx}`} className="print-break-inside">
                      <OrderGroupCard group={group} menuItemInfo={getMenuItemInfo(group.menuItem)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Grand total & Export tools */}
              <div className="no-print mt-6 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                <div>
                  <p className="text-sm text-slate-300 font-medium">Grand Summary</p>
                  <p className="text-xl font-bold mt-1">
                    {totalItems} total items across {grouped.length} menu items
                  </p>
                  {menuItems.length > 0 && (
                    <p className="text-emerald-400 text-sm font-semibold mt-1">
                      Grand Total Cost: Rs. {activeBatchTotalCost.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportDailyCSV}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    📥 Export Daily CSV Summary
                  </button>
                  <button
                    onClick={handleSaveDailyTotal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    💾 Save Daily Total
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
                  >
                    <PrintIcon /> Print Kitchen Report
                  </button>
                </div>
              </div>
            </div>
          )
        ) : activeTab === 'historical' ? (
          /* Total Cost Calculator Tab */
          <div className="space-y-8">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Total Cost Calculator</h2>
              <p className="text-slate-500 mt-1 max-w-2xl text-sm">
                Calculate the total combined cost of all previous daily orders. You can upload previously exported Daily CSV summaries below, or view/manage totals saved to the shared database.
              </p>

              {/* Historical Upload Area */}
              <div className="mt-6 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-4xl">📂</span>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Upload Vendor Orders or Daily CSV Summaries</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Select one or more <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">.csv</code> or <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">.xlsx</code> files — vendor-orders exports or daily_summary CSVs
                    </p>
                  </div>
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors mt-2 shadow-sm inline-block">
                    Choose Files
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const name = file.name;
                            if (name.toLowerCase().endsWith('.xlsx')) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const arrayBuffer = evt.target?.result as ArrayBuffer;
                                const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
                                const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
                                handleSummaryUpload(csv, name);
                              };
                              reader.readAsArrayBuffer(file);
                            } else {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const text = evt.target?.result as string;
                                handleSummaryUpload(text, name);
                              };
                              reader.readAsText(file);
                            }
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {historicalError && (
                <div className={`mt-4 p-4 border rounded-2xl text-sm ${historicalError.startsWith('Duplicate:') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  {historicalError.startsWith('Duplicate:') ? '⚠️ ' : '⚠️ '}<strong>{historicalError.startsWith('Duplicate:') ? 'Duplicate File:' : 'Error parsing file:'}</strong> {historicalError.startsWith('Duplicate:') ? historicalError.slice('Duplicate: '.length) : historicalError}
                </div>
              )}
            </div>

            {/* Calculations Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-2xl shadow-sm">
                <p className="text-sm text-indigo-100 font-medium">Total Cost</p>
                <p className="text-3xl font-extrabold mt-1">
                  Rs. {(cumulativeHistoricalCost + savedTotals.reduce((sum, t) => sum + t.totalCost, 0)).toFixed(2)}
                </p>
                <p className="text-xs text-indigo-200 mt-1">Combined from uploaded CSVs + saved database records</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm text-slate-500 font-medium">Total Items Quantity</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {cumulativeHistoricalQuantity + savedTotals.reduce((sum, t) => sum + t.totalQuantity, 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">Total plates or products fulfilled</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm text-slate-500 font-medium">Processed Sources</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {savedUploads.length + savedTotals.length}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {savedUploads.length} uploaded files • {savedTotals.length} saved records
                </p>
              </div>
            </div>

            {/* Total Menu Item Cost Breakdown */}
            {cumulativeBreakdown.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-4 mb-4 flex items-center gap-2">
                  <span>📊</span> Total Menu Item Cost Breakdown & Verification
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  💡 Click on any menu item row below to expand its history, dates ordered, and verify sources.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">🍛 Menu Item</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">📦 Total Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">🏷️ Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">💰 Total Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cumulativeBreakdown.map((item, idx) => {
                        const isExpanded = expandedItem === item.name;
                        return (
                          <Fragment key={idx}>
                            <tr
                              onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                              className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-4 text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <span className={cn(
                                  "text-xs transition-transform inline-block",
                                  isExpanded ? "rotate-90 text-indigo-600" : "text-slate-400"
                                )}>
                                  ▶
                                </span>
                                {item.displayName}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500">
                                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">
                                  {item.totalQty} units
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-600 text-right">Rs. {(item.totalQty > 0 ? item.totalCost / item.totalQty : 0).toFixed(2)}</td>
                              <td className="px-4 py-4 text-sm font-bold text-indigo-600 text-right">Rs. {item.totalCost.toFixed(2)}</td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={4} className="px-6 py-4 bg-slate-50/60 border-y border-slate-100">
                                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                                    📋 Verification Details ({item.occurrences.length} record{item.occurrences.length !== 1 ? 's' : ''}):
                                  </div>
                                  <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                          <th className="px-4 py-2 text-left">📅 Date</th>
                                          <th className="px-4 py-2 text-left">📂 Source Record/File</th>
                                          <th className="px-4 py-2 text-center">Qty</th>
                                          <th className="px-4 py-2 text-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {item.occurrences.map((occ, oIdx) => (
                                          <tr key={oIdx} className="hover:bg-slate-50/30 text-xs">
                                            <td className="px-4 py-2 text-slate-700 font-medium">{occ.date}</td>
                                            <td className="px-4 py-2 text-slate-500 font-mono text-[11px]">{occ.source}</td>
                                            <td className="px-4 py-2 text-slate-700 text-center font-semibold">{occ.quantity}</td>
                                            <td className="px-4 py-2 text-indigo-600 text-right font-semibold">Rs. {occ.subtotal.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-indigo-50/50 font-bold border-t-2 border-indigo-100">
                        <td className="px-4 py-4 text-sm text-indigo-950 font-extrabold flex items-center gap-2">
                          <span>📊</span> Total Summary
                        </td>
                        <td className="px-4 py-4 text-sm text-indigo-900 font-extrabold">
                          {cumulativeBreakdown.reduce((sum, item) => sum + item.totalQty, 0)} units
                        </td>
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4 text-sm text-indigo-600 text-right font-extrabold">
                          Rs. {cumulativeBreakdown.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Uploaded Summaries list */}
            {savedUploads.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <h3 className="font-bold text-slate-900">Uploaded Summary Files</h3>
                  <button
                    onClick={handleResetHistorical}
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    Clear All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Format</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savedUploads.map((upload) => (
                        <tr key={upload.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-sm">
                            <input
                              type="text"
                              defaultValue={upload.name}
                              onBlur={(e) => handleRenameUpload(upload.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-full text-slate-800 font-medium bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none rounded-lg px-2 py-1 transition-colors"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {upload.date || <span className="italic text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              upload.format === 'vendor-orders'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {upload.format === 'vendor-orders' ? 'vendor-orders' : 'daily-summary'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{upload.summaries.length} items</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleDeleteUpload(upload.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Saved Daily Totals list */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-4 mb-4">Saved Daily Totals</h3>
              {savedTotals.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No saved daily totals yet. Go to "Active Batch Processor", load orders, and click "Save Daily Total".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">📅 Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">📁 Batch File Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">📦 Total Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">💲 Total Cost</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savedTotals.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.date}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 font-mono">{item.batchName}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.totalQuantity}</td>
                          <td className="px-4 py-3 text-sm font-bold text-emerald-600">Rs. {item.totalCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleDeleteSavedTotal(item.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Order Checker Tab */
          <div className="py-2">
            <OrderChecker />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-100 mt-12 py-6 text-center text-xs text-slate-400">
        Catering Order Manager • Upload CSV to get started
      </footer>

      {/* User Guide Modal */}
      {showGuide && (
        <div className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📖</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">User Setup & Help Guide</h3>
                  <p className="text-xs text-slate-500">Learn how to setup and run locally, format your CSV, and use the dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <XIcon />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 md:p-8 space-y-8 overflow-y-auto text-slate-700 leading-relaxed">
              {/* Section 1 */}
              <div>
                <h4 className="text-md font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">💻 1. Local PC Setup Guide</h4>
                <p className="text-sm mb-4">To run this catering order manager on any local PC, follow these simple steps:</p>
                <ol className="list-decimal list-inside space-y-2.5 text-sm pl-2">
                  <li>
                    <strong>Install Node.js:</strong> Go to <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">nodejs.org</a>, download, and install the LTS version.
                  </li>
                  <li>
                    <strong>Open Terminal / Command Prompt:</strong> Navigate to the folder containing your project files:
                    <pre className="mt-1.5 bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600">cd path/to/your/catering-manager</pre>
                  </li>
                  <li>
                    <strong>Install Dependencies:</strong> Run the following command:
                    <pre className="mt-1.5 bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600">npm install</pre>
                  </li>
                  <li>
                    <strong>Start Local Server:</strong> Run:
                    <pre className="mt-1.5 bg-slate-50 p-2 rounded-lg font-mono text-xs text-slate-600">npm run dev</pre>
                  </li>
                  <li>
                    <strong>Open in Browser:</strong> Copy and open the displayed URL (usually <code className="bg-slate-50 text-indigo-600 px-1 py-0.5 rounded font-mono text-xs">http://localhost:5173</code>) in any modern browser.
                  </li>
                </ol>
              </div>

              {/* Section 2 */}
              <div>
                <h4 className="text-md font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">📊 2. Preparing your CSV File</h4>
                <p className="text-sm mb-3">Your spreadsheet must save as a <strong>.csv</strong> file with these headers:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-semibold mb-4">
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"First Name"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Last Name"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Order Date"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Menu Item"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Quantity"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Product Vendor"</span>
                  <span className="bg-slate-100 p-2 rounded text-center text-slate-700">"Order Note"</span>
                </div>
                <p className="text-xs text-slate-500">
                  💡 <em>Note: If you are using Excel or Google Sheets, just name your columns exactly like the list above and save/download as "CSV (comma-delimited)".</em>
                </p>
              </div>

              {/* Section 3 */}
              <div>
                <h4 className="text-md font-bold text-slate-900 border-l-4 border-indigo-500 pl-3 mb-3">🚀 3. Application Features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 mb-1">🍽️ Automatic Grouping</p>
                    <p className="text-xs text-slate-500">Orders are instantly combined by menu items with a bold summary of total quantities to prepare.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 mb-1">⚠️ Special Notes Alert</p>
                    <p className="text-xs text-slate-500">Specific order notes (e.g. allergies or custom toppings) are highlighted in bright orange with warning icons so they aren't missed.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 mb-1">🔍 Real-time Search</p>
                    <p className="text-xs text-slate-500">Instantly search for items, specific customers, vendors, or keywords in custom notes as you type.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 mb-1">🖨️ Print Optimization</p>
                    <p className="text-xs text-slate-500">Click print to produce beautifully formatted, clean physical paper kitchen copies or save as PDF.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Got it, let's start!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
