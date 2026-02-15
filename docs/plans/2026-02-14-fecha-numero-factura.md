# Fecha y Número de Factura — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the invoice date and invoice number that Claude already extracts from PDFs — add dedicated DB columns, populate them during processing, and show/edit them in the UI.

**Architecture:** Add two nullable columns to the `invoices` table. During processing, copy extracted values from Claude's output to these columns. In the invoice detail page, show editable fields (same card pattern as provider/country). In the invoice list, show invoice number and date.

**Tech Stack:** Next.js 16, Supabase PostgreSQL, React 19, Tailwind CSS

---

### Task 1: Add columns to database

**Files:**
- Create: `supabase/migrations/add-invoice-date-number.sql`

**Step 1: Write the migration SQL**

```sql
ALTER TABLE invoices ADD COLUMN invoice_date DATE;
ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(100);
```

**Step 2: Run the migration**

Run this SQL in your Supabase dashboard (SQL Editor) since there's no automated migration runner. Copy the two ALTER TABLE statements and execute them.

**Step 3: Commit**

```bash
git add supabase/migrations/add-invoice-date-number.sql
git commit -m "feat: add invoice_date and invoice_number columns to invoices table"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add fields to Invoice interface**

In `src/lib/types.ts`, the `Invoice` interface (line 90-109). Add two fields after `country_code` (line 102):

```typescript
  invoice_date: string | null;
  invoice_number: string | null;
```

The interface should now have these lines in order:
```
  country_code: number | null;
  invoice_date: string | null;
  invoice_number: string | null;
  created_at: string;
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add invoice_date and invoice_number to Invoice type"
```

---

### Task 3: Save extracted values during processing

**Files:**
- Modify: `src/app/api/invoices/[id]/process/route.ts`

**Step 1: Add invoice_date and invoice_number to the update call**

In `processInvoiceInBackground()`, find the final update call (around line 158-168) that sets `status: "review"`. Add `invoice_date` and `invoice_number` from the extraction result:

```typescript
    await supabase
      .from("invoices")
      .update({
        status: "review",
        provider_id: providerId,
        total_items: itemsToInsert.length,
        items_auto_classified: exactMatches + semanticMatches,
        raw_extraction: extraction as unknown as Record<string, unknown>,
        processing_error: null,
        invoice_date: extraction.invoice_date || null,
        invoice_number: extraction.invoice_number || null,
      })
      .eq("id", id);
```

The `extraction` object already has `invoice_date` and `invoice_number` from Claude's header extraction (see `ExtractionResult` type and `extractHeader()` in `src/lib/claude.ts`).

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/app/api/invoices/[id]/process/route.ts
git commit -m "feat: save invoice_date and invoice_number during processing"
```

---

### Task 4: Show and edit invoice date/number in invoice detail page

**Files:**
- Modify: `src/app/(dashboard)/facturas/[id]/page.tsx`

This adds editable fields for `invoice_number` and `invoice_date` in the invoice detail page, following the same card pattern used for provider and country selectors.

**Step 1: Add state variables and handler**

After the provider selector state variables (around line 55), add:

```typescript
  // Invoice date/number editing
  const [editingInvoiceDate, setEditingInvoiceDate] = useState<string>("");
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<string>("");
  const [savingInvoiceFields, setSavingInvoiceFields] = useState(false);
```

**Step 2: Initialize state when invoice loads**

In the `fetchInvoice` function, after setting the invoice state (after `setInvoice(invoiceData as unknown as Invoice);`, around line 59), add:

```typescript
    const inv = invoiceData as unknown as Invoice;
    setEditingInvoiceDate(inv.invoice_date || "");
    setEditingInvoiceNumber(inv.invoice_number || "");
```

Note: change the existing `setInvoice(invoiceData as unknown as Invoice);` to `setInvoice(inv);` to reuse the variable.

**Step 3: Add save handler**

After the `canEditProvider` line, add:

```typescript
  const handleSaveInvoiceField = async (field: "invoice_date" | "invoice_number", value: string) => {
    setSavingInvoiceFields(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      setInvoice((prev) => prev ? { ...prev, [field]: value || null } : null);
    }
    setSavingInvoiceFields(false);
  };
```

**Step 4: Add UI card**

After the provider selector cards (after the `{/* Provider display (when not editable) */}` section), and before `{/* Error */}`, add:

```tsx
      {/* Invoice number & date */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Invoice number */}
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-gray-400 shrink-0" />
            <label className="text-sm font-medium text-gray-700 shrink-0">
              Nº Factura
            </label>
            {canEditProvider ? (
              <input
                type="text"
                value={editingInvoiceNumber}
                onChange={(e) => setEditingInvoiceNumber(e.target.value)}
                onBlur={() => handleSaveInvoiceField("invoice_number", editingInvoiceNumber)}
                placeholder="Sin número"
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] w-40"
              />
            ) : (
              <span className="text-sm text-gray-900">
                {invoice?.invoice_number || "—"}
              </span>
            )}
          </div>

          {/* Invoice date */}
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <label className="text-sm font-medium text-gray-700 shrink-0">
              Fecha factura
            </label>
            {canEditProvider ? (
              <input
                type="date"
                value={editingInvoiceDate}
                onChange={(e) => {
                  setEditingInvoiceDate(e.target.value);
                  handleSaveInvoiceField("invoice_date", e.target.value);
                }}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
              />
            ) : (
              <span className="text-sm text-gray-900">
                {invoice?.invoice_date ? formatDate(invoice.invoice_date) : "—"}
              </span>
            )}
          </div>

          {savingInvoiceFields && (
            <Loader2 size={14} className="animate-spin text-[#2E86C1]" />
          )}
        </div>
      </div>
```

**Step 5: Add Calendar import**

Add `Calendar` to the lucide-react imports at the top of the file. Also add `FileText` if not already imported (check first — it might not be imported yet in this file).

**Step 6: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 7: Manual verification**

1. Open a factura in status "review" → see Nº Factura and Fecha factura fields, editable
2. Type a number → blur → saves automatically
3. Pick a date → saves immediately
4. Open a factura in status "approved" → fields are read-only

**Step 8: Commit**

```bash
git add src/app/(dashboard)/facturas/[id]/page.tsx
git commit -m "feat: show and edit invoice date and number in detail page"
```

---

### Task 5: Show invoice number and date in invoice list

**Files:**
- Modify: `src/components/invoice/invoice-list.tsx`

**Step 1: Add invoice_number and invoice_date display**

In the invoice list item (around line 117), the metadata line shows provider, date, and item count. Add `invoice_number` before the provider name, and show `invoice_date` (if available) instead of only `created_at`.

Replace lines 117-131 (the metadata `<div>`) with:

```tsx
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {invoice.invoice_number && (
                        <span className="font-mono text-xs">
                          #{invoice.invoice_number}
                        </span>
                      )}
                      {invoice.provider && (
                        <span>
                          {
                            (
                              invoice.provider as unknown as { name: string }
                            ).name
                          }
                        </span>
                      )}
                      <span>
                        {invoice.invoice_date
                          ? formatDate(invoice.invoice_date)
                          : formatDate(invoice.created_at)}
                      </span>
                      {invoice.total_items > 0 && (
                        <span>{invoice.total_items} ítems</span>
                      )}
                    </div>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/components/invoice/invoice-list.tsx
git commit -m "feat: show invoice number and date in invoice list"
```

---

### Task 6: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Build passes clean

**Step 2: Lint**

Run: `npm run lint`
Expected: No new errors from our changes

**Step 3: E2E manual test**

1. Verify DB migration ran (check Supabase table viewer for `invoice_date` and `invoice_number` columns)
2. Process a new invoice → check that `invoice_date` and `invoice_number` get populated
3. Open the invoice detail → see Nº Factura and Fecha factura fields
4. Edit both fields → verify they save
5. Check the invoice list → see invoice number and date displayed
6. Open an approved invoice → fields are read-only
