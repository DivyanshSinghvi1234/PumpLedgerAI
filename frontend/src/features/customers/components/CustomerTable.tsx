import CustomerActions from "./CustomerActions";

import type { Customer } from "../types/customer";

interface Props {
  customers: Customer[];
  onViewLedger(customer: Customer): void;
  onEdit(customer: Customer): void;
  onDelete(customer: Customer): void;
}

export default function CustomerTable({
  customers,
  onViewLedger,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Code
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mobile
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              GST
            </th>

            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outstanding
            </th>

            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.uuid}
              className="border-t border-border"
            >
              <td className="px-4 py-3">
                {customer.customer_code}
              </td>

              <td className="px-4 py-3">
                {customer.name}
              </td>

              <td className="px-4 py-3">
                {customer.mobile}
              </td>

              <td className="px-4 py-3">
                {customer.gst_number}
              </td>

              <td className="px-4 py-3 text-right">
                ₹
                {Number(
                  customer.outstanding_balance
                ).toLocaleString()}
              </td>

              <td className="px-4 py-3">
                <CustomerActions
                  onViewLedger={() =>
                    onViewLedger(customer)
                  }
                  onEdit={() =>
                    onEdit(customer)
                  }
                  onDelete={() =>
                    onDelete(customer)
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}