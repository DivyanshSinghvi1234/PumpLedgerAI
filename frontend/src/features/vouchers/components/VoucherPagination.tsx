import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;

  onPageChange(page: number): void;
}

export default function VoucherPagination({
  page,
  totalPages,
  onPageChange,
}: Props) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex items-center justify-between">

      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">

        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() =>
            onPageChange(page - 1)
          }
        >
          Previous
        </Button>

        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() =>
            onPageChange(page + 1)
          }
        >
          Next
        </Button>

      </div>
    </div>
  );
}