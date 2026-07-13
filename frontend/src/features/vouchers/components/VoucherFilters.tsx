import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  fuelType: string;
  paymentMode: string;

  onFuelChange(value: string): void;
  onPaymentChange(value: string): void;
}

export default function VoucherFilters({
  fuelType,
  paymentMode,
  onFuelChange,
  onPaymentChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <Select
        value={fuelType}
        onValueChange={(value) =>
          onFuelChange(value ?? "ALL")
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Fuel Type" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="ALL">
            All Fuel
          </SelectItem>

          <SelectItem value="PETROL">
            Petrol
          </SelectItem>

          <SelectItem value="DIESEL">
            Diesel
          </SelectItem>

          <SelectItem value="LUBRICANT">
            Lubricant
          </SelectItem>

          <SelectItem value="CNG">
            CNG
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={paymentMode}
        onValueChange={(value) =>
          onPaymentChange(value ?? "ALL")
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Payment" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="ALL">
            All Payments
          </SelectItem>

          <SelectItem value="CASH">
            Cash
          </SelectItem>

          <SelectItem value="CARD">
            Card
          </SelectItem>

          <SelectItem value="UPI">
            UPI
          </SelectItem>

          <SelectItem value="CREDIT">
            Credit
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}