"use client";

import { useState } from "react";
import { useInventory, useAdjustInventory, useTransferStock, useWarehouses } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

type Modal = { type: "adjust"; variantId: string } | { type: "transfer"; variantId: string; warehouseId: string };

export default function InventoryPage() {
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | undefined>(undefined);
  const warehouses = useWarehouses();
  const inventory = useInventory(lowStockOnly, selectedWarehouseId);
  const adjust = useAdjustInventory();
  const transfer = useTransferStock();

  const [modal, setModal] = useState<Modal | null>(null);
  const [delta, setDelta] = useState(0);
  const [reasonCode, setReasonCode] = useState("manual_correction");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => { setModal(null); setError(null); setDelta(0); setTransferQty(1); };

  const submitAdjustment = () => {
    if (modal?.type !== "adjust") return;
    setError(null);
    adjust.mutate(
      { variantId: modal.variantId, dto: { delta, reasonCode: reasonCode as any } },
      { onSuccess: closeModal, onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong.") },
    );
  };

  const submitTransfer = () => {
    if (modal?.type !== "transfer") return;
    if (!toWarehouseId) { setError("Select a destination warehouse."); return; }
    if (toWarehouseId === modal.warehouseId) { setError("Source and destination must differ."); return; }
    setError(null);
    transfer.mutate(
      { variantId: modal.variantId, fromWarehouseId: modal.warehouseId, toWarehouseId, quantity: transferQty },
      { onSuccess: closeModal, onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong.") },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Inventory</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedWarehouseId ?? ""}
            onChange={(e) => setSelectedWarehouseId(e.target.value || undefined)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="">All warehouses</option>
            {warehouses.data?.map((wh: any) => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            Low stock only
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Warehouse</th>
              <th className="px-4 py-2 font-medium">Qty on hand</th>
              <th className="px-4 py-2 font-medium">Threshold</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {inventory.data?.map((row: any) => (
              <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="px-4 py-2">{row.variant.product.name}</td>
                <td className="px-4 py-2">{row.variant.sku}</td>
                <td className="px-4 py-2">{row.warehouse.name}</td>
                <td className="px-4 py-2">{row.quantityOnHand}</td>
                <td className="px-4 py-2">{row.lowStockThreshold ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setModal({ type: "adjust", variantId: row.variantId }); setError(null); }}
                      className="text-brand-600 hover:underline"
                    >
                      Adjust
                    </button>
                    {warehouses.data && warehouses.data.length > 1 && (
                      <button
                        onClick={() => { setModal({ type: "transfer", variantId: row.variantId, warehouseId: row.warehouseId }); setError(null); setToWarehouseId(""); }}
                        className="text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        Transfer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inventory.data?.length === 0 && <p className="p-4 text-sm text-zinc-500">No inventory records.</p>}
      </div>

      {/* Adjust modal */}
      {modal?.type === "adjust" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4 z-50">
          <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-950">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Adjust stock</h2>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Delta (+/-)</span>
              <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="input" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Reason</span>
              <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="input">
                <option value="sale">Sale</option>
                <option value="return">Return</option>
                <option value="damage">Damage</option>
                <option value="manual_correction">Manual correction</option>
              </select>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Cancel</button>
              <button onClick={submitAdjustment} disabled={adjust.isPending} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60">
                {adjust.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {modal?.type === "transfer" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4 z-50">
          <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-950">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Transfer stock</h2>
            <p className="text-sm text-zinc-500">
              From: <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {warehouses.data?.find((w: any) => w.id === modal.warehouseId)?.name ?? modal.warehouseId}
              </span>
            </p>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Destination warehouse</span>
              <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className="input">
                <option value="">Select…</option>
                {warehouses.data?.filter((w: any) => w.id !== modal.warehouseId).map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Quantity</span>
              <input type="number" min="1" value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value))} className="input" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Cancel</button>
              <button onClick={submitTransfer} disabled={transfer.isPending} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60">
                {transfer.isPending ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
