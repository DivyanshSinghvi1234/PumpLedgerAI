interface Props {
  status: "PENDING" | "VERIFIED" | "REJECTED";
}

const STYLES: Record<Props["status"], string> = {
  VERIFIED: "badge-success",
  REJECTED: "badge-error",
  PENDING: "badge-warning",
};

const LABELS: Record<Props["status"], string> = {
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  PENDING: "Pending Review",
};

export default function VoucherStatusBadge({
  status,
}: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function VoucherPaymentStatusBadge({
  status,
}: {
  status: "UNPAID" | "PARTIAL" | "PAID";
}) {
  const STYLES = {
    PAID: "badge-success",
    PARTIAL: "badge-warning",
    UNPAID: "badge-error",
  };

  const LABELS = {
    PAID: "Paid",
    PARTIAL: "Partial",
    UNPAID: "Unpaid",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}