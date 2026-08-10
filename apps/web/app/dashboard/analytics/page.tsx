"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAnalyticsBestSellers,
  useAnalyticsCustomers,
  useAnalyticsInventory,
  useAnalyticsOrders,
  useAnalyticsRevenue,
  useTenantProfile,
  type AnalyticsDateRange,
} from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { downloadReport } from "@/lib/api-client";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function ExportButtons({ type }: { type: string }) {
  const [pending, setPending] = useState<"csv" | "pdf" | null>(null);
  const handle = async (format: "csv" | "pdf") => {
    setPending(format);
    try {
      await downloadReport(`/analytics/export?type=${type}&format=${format}`, `analytics-${type}.${format}`);
    } finally {
      setPending(null);
    }
  };
  return (
    <div className="space-x-2">
      <button
        onClick={() => handle("csv")}
        disabled={pending !== null}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {pending === "csv" ? "Exporting…" : "Export CSV"}
      </button>
      <button
        onClick={() => handle("pdf")}
        disabled={pending !== null}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {pending === "pdf" ? "Exporting…" : "Export PDF"}
      </button>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsDateRange>({ granularity: "day" });

  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  const revenue = useAnalyticsRevenue(range);
  const orders = useAnalyticsOrders(range);
  const bestSellers = useAnalyticsBestSellers(range);
  const customers = useAnalyticsCustomers(range);
  const inventory = useAnalyticsInventory();

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Analytics</h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-zinc-500">
            From
            <input
              type="date"
              className="ml-1 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
            />
          </label>
          <label className="text-zinc-500">
            To
            <input
              type="date"
              className="ml-1 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
            />
          </label>
          <select
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            value={range.granularity}
            onChange={(e) => setRange((r) => ({ ...r, granularity: e.target.value as AnalyticsDateRange["granularity"] }))}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>

      {/* Revenue */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Revenue</h2>
          <ExportButtons type="revenue" />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-1">
          <StatTile label="Total Revenue" value={formatMoney(revenue.data?.totalRevenue ?? 0, currency)} />
        </div>
        <div className="h-64 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenue.data?.buckets ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Orders</h2>
          <ExportButtons type="orders" />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <StatTile label="Total Orders" value={String(orders.data?.totalOrders ?? 0)} />
          <StatTile label="Overall AOV" value={formatMoney(orders.data?.overallAOV ?? 0, currency)} />
        </div>
        <div className="h-64 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orders.data?.buckets ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="orderCount" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Best sellers / low performers */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Best Sellers &amp; Low Performers</h2>
          <ExportButtons type="best-sellers" />
        </div>
        <div className="h-64 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bestSellers.data?.bestSellers ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="productName" fontSize={11} hide />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#0891b2" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">Best sellers</p>
            <ul className="space-y-1">
              {bestSellers.data?.bestSellers?.slice(0, 5).map((b: any, i: number) => (
                <li key={i} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{b.productName}</span>
                  <span>{b.quantity} sold</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">Low performers</p>
            <ul className="space-y-1">
              {bestSellers.data?.lowPerformers?.slice(0, 5).map((p: any, i: number) => (
                <li key={i} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{p.name}</span>
                  <span>{p.quantity} sold</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Customers */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Customers</h2>
          <ExportButtons type="customers" />
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatTile label="New Customers" value={String(customers.data?.totalNewCustomers ?? 0)} />
          <StatTile label="Repeat Customers" value={String(customers.data?.repeatCustomers ?? 0)} />
          <StatTile
            label="Repeat Purchase Rate"
            value={`${(((customers.data?.repeatPurchaseRate ?? 0) as number) * 100).toFixed(1)}%`}
          />
        </div>
        <div className="h-64 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={customers.data?.newCustomersByBucket ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Inventory */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Inventory</h2>
          <ExportButtons type="inventory" />
        </div>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatTile label="Stock Value" value={formatMoney(inventory.data?.stockValue ?? 0, currency)} />
          <StatTile label="Units Sold In Range" value={String(inventory.data?.unitsSoldInRange ?? 0)} />
          <StatTile
            label="Turnover Ratio"
            value={inventory.data?.turnoverRatio == null ? "n/a" : inventory.data.turnoverRatio.toFixed(2)}
          />
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1 font-medium">Product</th>
              <th className="py-1 font-medium">SKU</th>
              <th className="py-1 font-medium">Qty on hand</th>
              <th className="py-1 font-medium">Threshold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {inventory.data?.lowStockItems?.map((item: any) => (
              <tr key={item.id}>
                <td className="py-1.5">{item.variant?.product?.name}</td>
                <td className="py-1.5 font-mono">{item.variant?.sku}</td>
                <td className="py-1.5">{item.quantityOnHand}</td>
                <td className="py-1.5">{item.lowStockThreshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inventory.data?.lowStockItems?.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">No low-stock items.</p>
        )}
      </section>
    </div>
  );
}
