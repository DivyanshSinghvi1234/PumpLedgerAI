import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Users, AlertCircle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/api/client";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";
import { formatCurrency } from "@/lib/utils";

interface WhatsAppDigestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WhatsAppDigestDialog({ open, onOpenChange }: WhatsAppDigestDialogProps) {
  const [minBalance] = useState("1.0");


  const { data: digest, isLoading, isError, refetch } = useQuery({
    queryKey: ["whatsapp-digest", minBalance],
    queryFn: async () => {
      const res = await api.post("/v1/customers/whatsapp-digest", null, {
        params: { min_balance: parseFloat(minBalance) || 1.0 },
      });
      return res.data;
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-hairline sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-hairline">
          <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-500" /> Monthly WhatsApp Balance Digest
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-subtle">
            Batch summary digest for credit account holders with outstanding balances for {digest?.month_year || "this month"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 px-1 space-y-4 flex-1 overflow-y-auto">
          {/* Summary Stat Card */}
          {digest && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-ink-subtle block font-mono text-[10px] uppercase">Total Credit Outstanding</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {formatCurrency(digest.total_outstanding_amount)}
                </span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent font-bold">
                <Users size={12} className="mr-1" /> {digest.total_customers} Customers
              </Badge>
            </div>
          )}

          {/* Recipient List */}
          {isLoading ? (
            <div className="py-8 text-center text-xs text-ink-subtle animate-pulse">
              Generating customer balance digest...
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-xs text-red-400 space-y-2">
              <AlertCircle size={20} className="mx-auto" />
              <p>Failed to load customer digest.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">Retry</Button>
            </div>
          ) : !digest?.items || digest.items.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-subtle italic">
              No credit customers found with outstanding balances above ₹{minBalance}.
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {digest.items.map((item: any) => (
                <div
                  key={item.customer_uuid}
                  className="bg-surface-2 border border-hairline p-3 rounded-lg flex items-center justify-between gap-3 text-xs hover:bg-surface-3 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-bold text-ink truncate block">{item.customer_name}</span>
                    <span className="text-[11px] text-ink-subtle font-mono">{item.phone || "No Mobile"}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatCurrency(item.closing_balance)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const url = getWhatsAppShareUrl(item.phone, item.message);
                        window.open(url, "_blank");
                      }}
                      disabled={!item.phone}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 cursor-pointer flex items-center gap-1.5"
                    >
                      <Send size={12} /> Send
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-hairline">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-9 cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
