import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Package, AlertTriangle, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import settingService from "@/features/settings/services/settingService";

export interface LubricantItem {
  id: string;
  name: string;
  category: "Engine Oil" | "2T Oil" | "Gear Oil" | "Grease" | "DEF / AdBlue" | "Other";
  unit_price: number;
  stock_qty: number;
  min_threshold: number;
}

const DEFAULT_ITEMS: LubricantItem[] = [
  { id: "1", name: "Servo 4T 20W-40 (1L)", category: "Engine Oil", unit_price: 380, stock_qty: 24, min_threshold: 5 },
  { id: "2", name: "Castrol Activ 4T (1L)", category: "Engine Oil", unit_price: 440, stock_qty: 18, min_threshold: 5 },
  { id: "3", name: "DEF / AdBlue Bucket (10L)", category: "DEF / AdBlue", unit_price: 650, stock_qty: 8, min_threshold: 3 },
  { id: "4", name: "2T Oil Pouch (50ml)", category: "2T Oil", unit_price: 25, stock_qty: 120, min_threshold: 20 },
  { id: "5", name: "Brake Fluid DOT 4 (250ml)", category: "Other", unit_price: 110, stock_qty: 12, min_threshold: 4 },
];

export default function LubricantsTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  const [items, setItems] = useState<LubricantItem[]>(DEFAULT_ITEMS);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state for adding new item
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<LubricantItem>>({
    name: "",
    category: "Engine Oil",
    unit_price: 350,
    stock_qty: 10,
    min_threshold: 5,
  });

  // Dialog state for stock adjustment
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LubricantItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<"ADD" | "SALE">("SALE");

  // Sync settings with backend
  const { data: savedItems } = useQuery({
    queryKey: ["settings", "lubricant_inventory"],
    queryFn: () => settingService.getSetting<LubricantItem[]>("lubricant_inventory"),
  });

  useEffect(() => {
    if (savedItems && savedItems.length > 0) {
      setItems(savedItems);
    }
  }, [savedItems]);

  const saveMutation = useMutation({
    mutationFn: (updated: LubricantItem[]) =>
      settingService.saveSetting("lubricant_inventory", updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "lubricant_inventory"] });
    },
  });

  const handleSaveItems = (updated: LubricantItem[]) => {
    setItems(updated);
    saveMutation.mutate(updated);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name?.trim()) return;

    const created: LubricantItem = {
      id: Date.now().toString(),
      name: newItem.name.trim(),
      category: newItem.category || "Engine Oil",
      unit_price: Number(newItem.unit_price) || 0,
      stock_qty: Number(newItem.stock_qty) || 0,
      min_threshold: Number(newItem.min_threshold) || 5,
    };

    const updated = [...items, created];
    handleSaveItems(updated);
    toast.success(`Added product "${created.name}"`);
    setAddOpen(false);
    setNewItem({ name: "", category: "Engine Oil", unit_price: 350, stock_qty: 10, min_threshold: 5 });
  };

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || adjustQty <= 0) return;

    const delta = adjustType === "ADD" ? adjustQty : -adjustQty;
    const updated = items.map((item) => {
      if (item.id === selectedItem.id) {
        const nextQty = Math.max(0, item.stock_qty + delta);
        return { ...item, stock_qty: nextQty };
      }
      return item;
    });

    handleSaveItems(updated);
    toast.success(
      adjustType === "ADD"
        ? `Added +${adjustQty} units to "${selectedItem.name}"`
        : `Recorded sale of ${adjustQty} units of "${selectedItem.name}"`
    );
    setAdjustOpen(false);
    setSelectedItem(null);
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = items.filter((item) => item.stock_qty <= item.min_threshold).length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-surface-1 border-hairline">
          <CardHeader className="pb-2">
            <CardDescription className="text-ink-muted">Total Products</CardDescription>
            <CardTitle className="text-2xl font-bold text-ink">{items.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-surface-1 border-hairline">
          <CardHeader className="pb-2">
            <CardDescription className="text-ink-muted">Low Stock Warnings</CardDescription>
            <CardTitle className="text-2xl font-bold text-fuel-amber flex items-center gap-2">
              {lowStockCount}
              {lowStockCount > 0 && <AlertTriangle size={20} className="text-fuel-amber animate-pulse" />}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-surface-1 border-hairline">
          <CardHeader className="pb-2">
            <CardDescription className="text-ink-muted">Total Packaged Stock</CardDescription>
            <CardTitle className="text-2xl font-bold text-ink">
              {items.reduce((sum, item) => sum + item.stock_qty, 0)} units
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
          <Input
            placeholder="Search lubricants, oils, or DEF buckets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-surface-1 border-hairline text-ink"
          />
        </div>

        {isAdminOrManager && (
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-gradient-to-r from-fuel-amber to-fuel-orange text-canvas font-bold hover:from-fuel-gold hover:to-fuel-amber cursor-pointer"
          >
            <Plus size={16} className="mr-2" />
            + Add Product
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-hairline bg-surface-2/50">
              <TableHead className="text-ink-muted">Product Name</TableHead>
              <TableHead className="text-ink-muted">Category</TableHead>
              <TableHead className="text-ink-muted text-right">Unit Price</TableHead>
              <TableHead className="text-ink-muted text-right">Stock Level</TableHead>
              <TableHead className="text-ink-muted text-center">Status</TableHead>
              <TableHead className="text-ink-muted text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-ink-muted">
                  No packaged lubricant or DEF products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isLowStock = item.stock_qty <= item.min_threshold;
                return (
                  <TableRow key={item.id} className="border-b border-hairline hover:bg-surface-2/30">
                    <TableCell className="font-semibold text-ink flex items-center gap-2">
                      <Package size={16} className="text-fuel-amber shrink-0" />
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-hairline text-ink-muted font-normal">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-ink">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-ink">
                      {item.stock_qty} units
                    </TableCell>
                    <TableCell className="text-center">
                      {isLowStock ? (
                        <Badge className="bg-error/15 text-error border-error/30">
                          Low Stock (&le; {item.min_threshold})
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          setAdjustType("SALE");
                          setAdjustQty(1);
                          setAdjustOpen(true);
                        }}
                        className="h-8 border-hairline text-ink hover:bg-surface-2"
                      >
                        <ArrowDownRight size={14} className="mr-1 text-emerald-500" />
                        Record Sale
                      </Button>
                      {isAdminOrManager && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setAdjustType("ADD");
                            setAdjustQty(10);
                            setAdjustOpen(true);
                          }}
                          className="h-8 border-hairline text-ink hover:bg-surface-2"
                        >
                          <ArrowUpRight size={14} className="mr-1 text-fuel-amber" />
                          + Restock
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Product Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md bg-card p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add New Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 mt-2">
            <div>
              <Label>Product Name</Label>
              <Input
                value={newItem.name || ""}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Servo 4T 20W-40 (1L)"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                  className="w-full h-10 rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink"
                >
                  <option value="Engine Oil">Engine Oil</option>
                  <option value="2T Oil">2T Oil</option>
                  <option value="Gear Oil">Gear Oil</option>
                  <option value="Grease">Grease</option>
                  <option value="DEF / AdBlue">DEF / AdBlue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label>Unit Price (₹)</Label>
                <Input
                  type="number"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Initial Stock Qty</Label>
                <Input
                  type="number"
                  value={newItem.stock_qty}
                  onChange={(e) => setNewItem({ ...newItem, stock_qty: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Low Stock Warning Threshold</Label>
                <Input
                  type="number"
                  value={newItem.min_threshold}
                  onChange={(e) => setNewItem({ ...newItem, min_threshold: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground">
                Add Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock / Sale Modal */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md bg-card p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {adjustType === "ADD" ? "Restock Product" : "Record Unit Sale"}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <form onSubmit={handleAdjustStock} className="space-y-4 mt-2">
              <div className="p-3 rounded-lg bg-surface-2 text-sm text-ink font-medium">
                Product: <span className="font-bold">{selectedItem.name}</span> (Current Stock: {selectedItem.stock_qty} units)
              </div>

              <div>
                <Label>{adjustType === "ADD" ? "Quantity to Add" : "Quantity Sold"}</Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value)))}
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={adjustType === "ADD" ? "bg-primary text-primary-foreground" : "bg-emerald-600 text-white"}
                >
                  {adjustType === "ADD" ? "Save Restock" : "Record Sale"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
