import { useState } from "react";

import SearchInput from "@/components/common/SearchInput";
import { Button } from "@/components/ui/button";

import VoucherFilters from "./VoucherFilters";

interface Props {
  onSearch(value: string): void;

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

  onCreate?(): void;

  canCreate?: boolean;
}

export default function VoucherToolbar({
  onSearch,
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
  onCreate,
  canCreate = true,
}: Props) {

  const [search, setSearch] = useState("");

  function handleSearch(value: string) {
    setSearch(value);

    onSearch(value);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

      <div className="flex flex-wrap gap-4 items-center">

        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search"
        />

        <VoucherFilters
          selectedFuelTypes={selectedFuelTypes}
          selectedPaymentModes={selectedPaymentModes}
          selectedStatuses={selectedStatuses}
          fromDate={fromDate}
          toDate={toDate}
          onFuelTypesChange={onFuelTypesChange}
          onPaymentModesChange={onPaymentModesChange}
          onStatusesChange={onStatusesChange}
          onFromDateChange={onFromDateChange}
          onToDateChange={onToDateChange}
        />

      </div>

      {canCreate && (
        <Button onClick={onCreate} className="shine bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber hover:text-canvas text-canvas font-bold border-none shadow-md shadow-fuel-amber/20 cursor-pointer">
          + New Voucher
        </Button>
      )}

    </div>
  );
}