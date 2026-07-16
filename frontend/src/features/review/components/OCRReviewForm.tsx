import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCreateVoucher } from "../../vouchers/hooks/useCreateVoucher";
import { uploadErrorMessage } from "../../upload/services/uploadService";
import InvoiceImageDialog from "../../vouchers/components/InvoiceImageDialog";
import { invoiceImageUrl } from "../../vouchers/utils/invoiceImage";
import CustomerAutocomplete from "../../customers/components/CustomerAutocomplete";
import FormDatePicker from "@/components/forms/FormDatePicker";
import { getTodayDateString } from "@/lib/utils";

type Props = {
  data: any;
};

const FUEL_TYPES = ["PETROL", "DIESEL", "LUBRICANT"];

const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CREDIT"];

// Which fields must be present before a voucher can be saved.
type FieldErrors = Record<string, string>;

export default function OCRReviewForm({
  data,
}: Props) {
  const navigate = useNavigate();
  const createMutation = useCreateVoucher();

  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(
    {},
  );

  const [showImage, setShowImage] = useState(false);

  // Fallback to construct items list from legacy fields if ocr.items is empty
  const initialItems = ocr.items && ocr.items.length > 0
    ? ocr.items.map((it: any) => ({
        fuel_type: it.fuel_type || "DIESEL",
        quantity_liters: it.quantity_liters ?? 0,
        rate_per_liter: it.rate_per_liter ?? 0,
        total_amount: it.total_amount ?? 0,
      }))
    : [{
        fuel_type: ocr.fuel_type || "DIESEL",
        quantity_liters: ocr.quantity_liters ?? 0,
        rate_per_liter: ocr.rate_per_liter ?? 0,
        total_amount: ocr.total_amount ?? 0,
      }];

  const [formData, setFormData] = useState({
    invoice_number: ocr.invoice_number ?? "",
    invoice_date: ocr.invoice_date || getTodayDateString(),
    vehicle_number: ocr.vehicle_number ?? "",
    customer_name: ocr.customer_name ?? "",
    customer_uuid: null as string | null,
    payment_mode: ocr.payment_mode ?? "",
    remarks: ocr.remarks ?? "",
    total_amount: ocr.total_amount ?? initialItems.reduce((sum: number, it: any) => sum + (Number(it.total_amount) || 0), 0),
    items: initialItems,
  });

  const expectedAmount = formData.items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
  const totalAmount = Number(formData.total_amount) || 0;
  const diff = Number(Math.abs(totalAmount - expectedAmount).toFixed(2));
  const isMismatch = diff > 0.05;

  function updateField(
    field: string,
    value: string | number | null
  ) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear a field's error as soon as the user edits it.
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateItem(index: number, field: string, value: any) {
    setFormData((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };

      if (field === "quantity_liters" || field === "rate_per_liter") {
        const q = Number(nextItems[index].quantity_liters) || 0;
        const r = Number(nextItems[index].rate_per_liter) || 0;
        nextItems[index].total_amount = Number((q * r).toFixed(2));
      }

      const newGrandTotal = nextItems.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

      return {
        ...prev,
        items: nextItems,
        total_amount: Number(newGrandTotal.toFixed(2)),
      };
    });
  }

  function addItem() {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          fuel_type: "DIESEL",
          quantity_liters: 0,
          rate_per_liter: 0,
          total_amount: 0,
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setFormData((prev) => {
      const nextItems = prev.items.filter((_, i) => i !== index);
      const newGrandTotal = nextItems.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
      return {
        ...prev,
        items: nextItems,
        total_amount: Number(newGrandTotal.toFixed(2)),
      };
    });
  }

  /**
   * Validate the required fields. Returns a map of field → message; empty
   * means the form is good to save.
   */
  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};

    if (!String(formData.invoice_number).trim()) {
      errors.invoice_number = "Invoice number is required.";
    }

    if (!String(formData.invoice_date).trim()) {
      errors.invoice_date = "Invoice date is required.";
    }

    if (!String(formData.payment_mode).trim()) {
      errors.payment_mode = "Payment mode is required.";
    }

    if (!(Number(formData.total_amount) > 0)) {
      errors.total_amount =
        "Total amount must be greater than 0.";
    }

    // A CREDIT sale must be tied to a customer to post to the ledger.
    if (
      formData.payment_mode === "CREDIT" &&
      !String(formData.customer_name).trim()
    ) {
      errors.customer_name =
        "Customer is required for a credit sale.";
    }

    if (formData.items.length === 0) {
      errors.items = "At least one product line item is required.";
    }

    formData.items.forEach((item, i) => {
      if (!item.fuel_type) {
        errors[`item_${i}_fuel_type`] = "Required";
      }
      if (!(Number(item.quantity_liters) > 0)) {
        errors[`item_${i}_quantity`] = "Must be > 0";
      }
      if (!(Number(item.rate_per_liter) > 0)) {
        errors[`item_${i}_rate`] = "Must be > 0";
      }
      if (!(Number(item.total_amount) > 0)) {
        errors[`item_${i}_amount`] = "Must be > 0";
      }
    });

    return errors;
  }

  async function handleSave() {
    const errors = validateForm();

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      setError("");

      await createMutation.mutateAsync({
        ...formData,
        // Preserve the uploaded invoice image on the saved voucher.
        image_path: imagePath,
      });

      navigate("/dashboard/vouchers");
    } catch (err) {
      console.error(err);

      setError(uploadErrorMessage(err));
    }
  }

  // Shared input classes; red ring + border when the field has an error.
  function inputClass(field: string) {
    return `w-full rounded border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink ${
      fieldErrors[field]
        ? "border-red-500 focus:ring-red-500"
        : ""
    }`;
  }

  function FieldError({ field }: { field: string }) {
    if (!fieldErrors[field]) return null;
    return (
      <p className="mt-1 text-sm text-red-600">
        {fieldErrors[field]}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(validation.errors?.length > 0 ||
        validation.warnings?.length > 0) && (
        <div className="space-y-2">
          {validation.errors?.map(
            (msg: string, i: number) => (
              <p
                key={`e-${i}`}
                className="rounded bg-red-50 px-4 py-2 text-red-700"
              >
                {msg}
              </p>
            )
          )}

          {validation.warnings?.map(
            (msg: string, i: number) => (
              <p
                key={`w-${i}`}
                className="rounded bg-amber-50 px-4 py-2 text-amber-700"
              >
                {msg}
              </p>
            )
          )}
        </div>
      )}

      {/* View the uploaded invoice image alongside the extracted fields. */}
      {imageUrl && (
        <button
          type="button"
          onClick={() => setShowImage(true)}
          className="rounded border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          🖼 View invoice image
        </button>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label>Invoice Number *</label>

          <input
            className={inputClass("invoice_number")}
            value={formData.invoice_number}
            onChange={(e) =>
              updateField(
                "invoice_number",
                e.target.value
              )
            }
          />
          <FieldError field="invoice_number" />
        </div>

        <div>
          <FormDatePicker
            label="Invoice Date"
            required
            value={formData.invoice_date}
            onChange={(e) =>
              updateField("invoice_date", e.target.value)
            }
          />
          <FieldError field="invoice_date" />
        </div>

        <div>
          <label>Vehicle Number</label>

          <input
            className={inputClass("vehicle_number")}
            value={formData.vehicle_number}
            onChange={(e) =>
              updateField(
                "vehicle_number",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <CustomerAutocomplete
            value={formData.customer_name}
            customerUuid={formData.customer_uuid}
            error={fieldErrors.customer_name}
            onChange={(name, uuid) => {
              setFormData((prev) => ({
                ...prev,
                customer_name: name,
                customer_uuid: uuid,
                payment_mode: uuid ? "CREDIT" : prev.payment_mode,
              }));
              setFieldErrors((prev) => {
                if (!prev.customer_name) return prev;
                const next = { ...prev };
                delete next.customer_name;
                return next;
              });
            }}
          />
        </div>

        <div className="sm:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2 mt-4">
            <h3 className="text-base font-bold text-ink">Product Line Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="rounded bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
            >
              ➕ Add Product Line
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-border bg-card">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="p-3 w-1/4">Product Name *</th>
                  <th className="p-3 w-1/4">Quantity (L/Units) *</th>
                  <th className="p-3 w-1/4">Rate (₹/Unit) *</th>
                  <th className="p-3 w-1/4">Line Total (₹) *</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => {
                  const fuelErr = fieldErrors[`item_${index}_fuel_type`];
                  const qtyErr = fieldErrors[`item_${index}_quantity`];
                  const rateErr = fieldErrors[`item_${index}_rate`];
                  const amtErr = fieldErrors[`item_${index}_amount`];

                  return (
                    <tr key={index} className="border-b border-border hover:bg-muted/10">
                      <td className="p-3">
                        <select
                          className={`rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink w-full ${fuelErr ? "border-red-500" : ""}`}
                          value={item.fuel_type}
                          onChange={(e) => updateItem(index, "fuel_type", e.target.value)}
                        >
                          {FUEL_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.001"
                          className={`rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink w-full ${qtyErr ? "border-red-500" : ""}`}
                          value={item.quantity_liters || ""}
                          onChange={(e) => updateItem(index, "quantity_liters", Number(e.target.value))}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          className={`rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink w-full ${rateErr ? "border-red-500" : ""}`}
                          value={item.rate_per_liter || ""}
                          onChange={(e) => updateItem(index, "rate_per_liter", Number(e.target.value))}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          className={`rounded border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink w-full ${amtErr ? "border-red-500" : ""}`}
                          value={item.total_amount || ""}
                          onChange={(e) => updateItem(index, "total_amount", Number(e.target.value))}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length <= 1}
                          className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center justify-center mx-auto min-w-[36px] min-h-[36px]"
                          title="Remove product line"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fieldErrors.items && (
            <p className="text-sm text-red-600 font-semibold">{fieldErrors.items}</p>
          )}
        </div>

        <div>
          <label>Payment Mode *</label>

          <select
            className={inputClass("payment_mode")}
            value={formData.payment_mode}
            onChange={(e) =>
              updateField(
                "payment_mode",
                e.target.value
              )
            }
          >
            <option value="" className="bg-surface-2 text-ink">Select payment mode</option>

            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode} className="bg-surface-2 text-ink">
                {mode}
              </option>
            ))}
          </select>
          <FieldError field="payment_mode" />
        </div>

        <div>
          <label>Total Invoice Amount (Grand Total) *</label>

          <input
            type="number"
            step="0.01"
            className={inputClass("total_amount")}
            value={formData.total_amount}
            onChange={(e) =>
              updateField(
                "total_amount",
                Number(e.target.value)
              )
            }
          />
          <FieldError field="total_amount" />
          {isMismatch && (
            <p className="mt-1.5 text-xs font-semibold text-amber-500">
              ⚠️ Amount Mismatch: Sum of items is ₹{expectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Difference: ₹{diff.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label>Remarks</label>

          <textarea
            rows={4}
            className="w-full rounded border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink"
            value={formData.remarks}
            onChange={(e) =>
              updateField(
                "remarks",
                e.target.value
              )
            }
          />
        </div>

        <div className="sm:col-span-2">
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="w-full rounded bg-primary px-6 py-3 text-primary-foreground disabled:bg-muted-foreground sm:w-auto"
          >
            {createMutation.isPending ? "Saving..." : "Save Voucher"}
          </button>

          {error && (
            <p className="mt-4 text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>

      <InvoiceImageDialog
        open={showImage}
        onOpenChange={setShowImage}
        imageUrl={imageUrl}
        invoiceNumber={formData.invoice_number}
      />
    </div>
  );
}
