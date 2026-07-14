import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

interface Props {
  selectedFuelTypes: string[];
  selectedPaymentModes: string[];
  selectedStatuses: string[];
  fromDate: string;
  toDate: string;

  onFuelTypesChange(values: string[]): void;
  onPaymentModesChange(values: string[]): void;
  onStatusesChange(values: string[]): void;
  onFromDateChange(value: string): void;
  onToDateChange(value: string): void;
}

const FUEL_OPTIONS = [
  { label: "Petrol", value: "PETROL" },
  { label: "Diesel", value: "DIESEL" },
  { label: "Lubricant", value: "LUBRICANT" },
];

const PAYMENT_OPTIONS = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

const STATUS_OPTIONS = [
  { label: "Pending", value: "PENDING" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Rejected", value: "REJECTED" },
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "dd/mm/yyyy";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function VoucherFilters({
  selectedFuelTypes,
  selectedPaymentModes,
  selectedStatuses,
  fromDate,
  toDate,
  onFuelTypesChange,
  onPaymentModesChange,
  onStatusesChange,
  onFromDateChange,
  onToDateChange,
}: Props) {
  const hasAnyActiveFilter =
    selectedFuelTypes.length > 0 ||
    selectedPaymentModes.length > 0 ||
    selectedStatuses.length > 0 ||
    fromDate !== "" ||
    toDate !== "";

  function handleClearAll() {
    onFuelTypesChange([]);
    onPaymentModesChange([]);
    onStatusesChange([]);
    onFromDateChange("");
    onToDateChange("");
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Fuel Type Multi-Select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "w-40 justify-between border-hairline bg-surface-1 text-ink-muted hover:text-ink cursor-pointer"
          )}
        >
          <span className="truncate">
            {selectedFuelTypes.length === 0
              ? "All Fuel Types"
              : `${selectedFuelTypes.length} Fuel ${selectedFuelTypes.length === 1 ? "Type" : "Types"}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-surface-1 border border-hairline shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Fuel Types</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {FUEL_OPTIONS.map((opt) => {
            const isChecked = selectedFuelTypes.includes(opt.value);
            return (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selectedFuelTypes, opt.value]
                    : selectedFuelTypes.filter((v) => v !== opt.value);
                  onFuelTypesChange(next);
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Payment Mode Multi-Select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "w-40 justify-between border-hairline bg-surface-1 text-ink-muted hover:text-ink cursor-pointer"
          )}
        >
          <span className="truncate">
            {selectedPaymentModes.length === 0
              ? "All Payments"
              : `${selectedPaymentModes.length} Payment${selectedPaymentModes.length === 1 ? "" : "s"}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-surface-1 border border-hairline shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Payment Modes</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {PAYMENT_OPTIONS.map((opt) => {
            const isChecked = selectedPaymentModes.includes(opt.value);
            return (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selectedPaymentModes, opt.value]
                    : selectedPaymentModes.filter((v) => v !== opt.value);
                  onPaymentModesChange(next);
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Multi-Select */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "w-40 justify-between border-hairline bg-surface-1 text-ink-muted hover:text-ink cursor-pointer"
          )}
        >
          <span className="truncate">
            {selectedStatuses.length === 0
              ? "All Statuses"
              : `${selectedStatuses.length} Status${selectedStatuses.length === 1 ? "" : "es"}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-surface-1 border border-hairline shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Verification Status</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((opt) => {
            const isChecked = selectedStatuses.includes(opt.value);
            return (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selectedStatuses, opt.value]
                    : selectedStatuses.filter((v) => v !== opt.value);
                  onStatusesChange(next);
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date Range Inputs with custom formatted labels */}
      <div className="flex items-center gap-2 border border-hairline rounded-lg bg-surface-1 px-3 py-1 h-8">
        <span className="text-xs text-ink-muted select-none">Date range:</span>
        <div className="relative flex items-center justify-center cursor-pointer min-w-[70px]">
          <span className={cn("text-xs font-mono transition-colors", fromDate ? "text-ink" : "text-ink-muted hover:text-ink")}>
            {formatDateDisplay(fromDate)}
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {}
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-xs text-ink-muted select-none">—</span>
        <div className="relative flex items-center justify-center cursor-pointer min-w-[70px]">
          <span className={cn("text-xs font-mono transition-colors", toDate ? "text-ink" : "text-ink-muted hover:text-ink")}>
            {formatDateDisplay(toDate)}
          </span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {}
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              onFromDateChange("");
              onToDateChange("");
            }}
            className="text-ink-muted hover:text-red-500 cursor-pointer ml-1 flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Clear All Button */}
      {hasAnyActiveFilter && (
        <Button
          variant="ghost"
          onClick={handleClearAll}
          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer h-8"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}