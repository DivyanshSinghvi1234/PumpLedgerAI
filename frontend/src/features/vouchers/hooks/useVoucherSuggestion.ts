import { useEffect, useRef, useState } from "react";
import voucherService from "../services/voucherService";
import type {
  VoucherSuggestRequest,
  VoucherSuggestionResponse,
} from "@/types/voucher";

/**
 * Debounced smart auto-fill hook for voucher & OCR review forms.
 * Uses plain fetch state so it also works inside unit tests without a QueryClientProvider.
 */
export function useVoucherSuggestion(
  request: VoucherSuggestRequest,
  enabled = true
) {
  const [suggestion, setSuggestion] = useState<VoucherSuggestionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const payloadKey = JSON.stringify({
    vehicle_number: request.vehicle_number?.trim() || null,
    customer_uuid: request.customer_uuid || null,
    customer_name: request.customer_name?.trim() || null,
    fuel_type: request.fuel_type || null,
    quantity_liters:
      request.quantity_liters && Number(request.quantity_liters) > 0
        ? Number(request.quantity_liters)
        : null,
    total_amount:
      request.total_amount && Number(request.total_amount) > 0
        ? Number(request.total_amount)
        : null,
    invoice_date: request.invoice_date || null,
    exclude_voucher_uuid: request.exclude_voucher_uuid || null,
  });

  useEffect(() => {
    if (!enabled) return;

    const parsed = JSON.parse(payloadKey) as VoucherSuggestRequest;
    const hasContext = Boolean(
      parsed.vehicle_number ||
        parsed.customer_uuid ||
        parsed.customer_name ||
        parsed.fuel_type
    );
    if (!hasContext) {
      setSuggestion(null);
      return;
    }

    const reqId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await voucherService.suggestVoucher(parsed);
        if (requestIdRef.current === reqId) {
          setSuggestion(res);
        }
      } catch {
        // Silently degrade if offline or unauthenticated in isolated test harnesses
      } finally {
        if (requestIdRef.current === reqId) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [payloadKey, enabled]);

  return { suggestion, isLoading };
}
