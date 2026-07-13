import type { Payment } from "../types/payment";

interface Props {
  payments: Payment[];
  canManage?: boolean;
  onDelete(payment: Payment): void;
}

export default function PaymentTable({
  payments,
  canManage = true,
  onDelete,
}: Props) {

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No payments found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Date
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </th>

            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mode
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reference
            </th>

            {canManage && (
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr
              key={payment.uuid}
              className="border-t border-border"
            >
              <td className="px-4 py-3">
                {payment.payment_date}
              </td>

              <td className="px-4 py-3 font-medium">
                {payment.customer_name}
              </td>

              <td className="px-4 py-3 text-right">
                ₹{payment.amount}
              </td>

              <td className="px-4 py-3">
                {payment.payment_mode}
              </td>

              <td className="px-4 py-3">
                {payment.reference_number ?? "-"}
              </td>

              {canManage && (
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      onDelete(payment)
                    }
                    className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
