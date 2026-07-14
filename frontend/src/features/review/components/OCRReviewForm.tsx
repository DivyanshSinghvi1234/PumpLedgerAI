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

  // The backend returns { ocr, validation, ready_to_save }.
  const ocr = data?.ocr ?? {};

  const validation = data?.validation ?? {
    warnings: [],
    errors: [],
  };

  // Path to the uploaded invoice image, carried through so the saved
  // voucher keeps its source image.
  const imagePath: string | null = ocr.image_path ?? null;

  const imageUrl = invoiceImageUrl(imagePath);

  const [formData, setFormData] = useState({
    invoice_number: ocr.invoice_number ?? "",
    invoice_date: ocr.invoice_date || getTodayDateString(),
    vehicle_number: ocr.vehicle_number ?? "",
    customer_name: ocr.customer_name ?? "",
    customer_uuid: null as string | null,
    fuel_type: ocr.fuel_type ?? "",
    quantity_liters: ocr.quantity_liters ?? 0,
    rate_per_liter: ocr.rate_per_liter ?? 0,
    total_amount: ocr.total_amount ?? 0,
    payment_mode: ocr.payment_mode ?? "",
    remarks: ocr.remarks ?? "",
  });

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

    if (!String(formData.fuel_type).trim()) {
      errors.fuel_type = "Fuel type is required.";
    }

    if (!String(formData.payment_mode).trim()) {
      errors.payment_mode = "Payment mode is required.";
    }

    if (!(Number(formData.quantity_liters) > 0)) {
      errors.quantity_liters =
        "Quantity must be greater than 0.";
    }

    if (!(Number(formData.rate_per_liter) > 0)) {
      errors.rate_per_liter =
        "Rate must be greater than 0.";
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
    return `w-full rounded border p-2 ${
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

        <div>
          <label>Fuel Type *</label>

          <select
            className={inputClass("fuel_type")}
            value={formData.fuel_type}
            onChange={(e) =>
              updateField(
                "fuel_type",
                e.target.value
              )
            }
          >
            <option value="">Select fuel type</option>

            {FUEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <FieldError field="fuel_type" />
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
            <option value="">Select payment mode</option>

            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <FieldError field="payment_mode" />
        </div>

        <div>
          <label>Quantity (L) *</label>

          <input
            type="number"
            className={inputClass("quantity_liters")}
            value={formData.quantity_liters}
            onChange={(e) =>
              updateField(
                "quantity_liters",
                Number(e.target.value)
              )
            }
          />
          <FieldError field="quantity_liters" />
        </div>

        <div>
          <label>Rate Per Liter *</label>

          <input
            type="number"
            className={inputClass("rate_per_liter")}
            value={formData.rate_per_liter}
            onChange={(e) =>
              updateField(
                "rate_per_liter",
                Number(e.target.value)
              )
            }
          />
          <FieldError field="rate_per_liter" />
        </div>

        <div>
          <label>Total Amount *</label>

          <input
            type="number"
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
        </div>

        <div className="sm:col-span-2">
          <label>Remarks</label>

          <textarea
            rows={4}
            className="w-full rounded border p-2"
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
