import { useState } from "react";

import SearchInput from "@/components/common/SearchInput";
import { Button } from "@/components/ui/button";

import VoucherFilters from "./VoucherFilters";

interface Props {
  onSearch(value: string): void;

  onFuelChange(value: string): void;

  onPaymentChange(value: string): void;

  onCreate?(): void;

  canCreate?: boolean;
}

export default function VoucherToolbar({
  onSearch,
  onFuelChange,
  onPaymentChange,
  onCreate,
  canCreate = true,
}: Props) {

  const [search, setSearch] = useState("");

  const [fuel, setFuel] = useState("ALL");

  const [payment, setPayment] = useState("ALL");

  function handleSearch(value: string) {
    setSearch(value);

    onSearch(value);
  }

  function handleFuel(value: string) {
    setFuel(value);

    onFuelChange(value);
  }

  function handlePayment(value: string) {
    setPayment(value);

    onPaymentChange(value);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">

      <div className="flex flex-wrap gap-4">

        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search invoice..."
        />

        <VoucherFilters
          fuelType={fuel}
          paymentMode={payment}
          onFuelChange={handleFuel}
          onPaymentChange={handlePayment}
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