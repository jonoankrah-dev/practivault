import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Package, AlertTriangle, TrendingDown, TrendingUp,
  Trash2, ArrowDownCircle, ArrowUpCircle, Download, Search,
} from "lucide-react";

type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  cost_price: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
};

type StockMovement = {
  id: string;
  stock_item_id: string;
  movement_type: "in" | "out";
  quantity: number;
  notes: string | null;
  created_at: string;
};

const CATEGORIES = [
  "Aesthetics & Beauty",
  "Hair & Nails",
  "Plumbing",
  "Electrical",
  "Joinery & Carpentry",
  "Landscaping & Lawncare",
  "Health & Wellness",
  "HVAC & Machine Servicing",
  "Building & Bricklaying",
  "CPD & Training",
  "General",
];

const UNITS = ["units", "litres", "kg", "metres", "rolls", "boxes", "packs", "pairs", "sheets", "bags"];

const CATEGORY_EXAMPLES: Record<string, string> = {
  "Aesthetics & Beauty": "e.g. filler, cannulas, numbing cream, PPE, syringes",
  "Hair & Nails": "e.g. colour, developer, acrylics, foils, nail tips",
  "Plumbing": "e.g. fittings, pipe, PTFE tape, valves, solder",
  "Electrical": "e.g. cable, connectors, fuses, sockets, trunking",
  "Joinery & Carpentry": "e.g. screws, timber, adhesive, sandpaper, fixings",
  "Landscaping & Lawncare": "e.g. fertiliser, grass seed, bark, fuel, weedkiller",
  "Health & Wellness": "e.g. gloves, oils, linens, massage wax, couch roll",
  "HVAC & Machine Servicing": "e.g. filters, refrigerant, belts, fuses, coil cleaner, o-rings",
  "Building & Bricklaying": "e.g. cement, sand, blocks, wall ties, mortar",
  "CPD & Training": "e.g. printed materials, workbooks, pens, lanyards",
  "General": "e.g. cleaning products, labels, printer paper, batteries",
};

function formatGBP(n: number) {
  return `£${Number(n || 0).toFixed(2)}`;
}

export default function Stock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<StockItem | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  // Add item form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [unit, setUnit] = useState("units");
  const [quantity, setQuantity] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(5);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplier, setSupplier] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  // Movement form
  const [moveType, setMoveType] = useState<"in" | "out">("in");
  const [moveQty, setMoveQty] = useState<number>(1);
  const [moveNotes, setMoveNotes] = useState("");

  const { data: items = [], isLoading } = useQuery<StockItem[]>({ queryKey: ["/api/stock"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/stock", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      toast({ title: "Stock item added" });
      setAddOpen(false);
      resetAddForm();
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/stock/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      toast({ title: "Item removed" });
    },
  });

  const movementMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/stock/movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock"] });
      toast({ title: moveType === "in" ? "Stock added" : "Stock used" });
      setMoveOpen(null);
      setMoveQty(1);
      setMoveNotes("");
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  function resetAddForm() {
    setName(""); setCategory("General"); setUnit("units");
    setQuantity(0); setThreshold(5); setCostPrice(0); setSupplier(""); setItemNotes("");
  }

  function handleCreate() {
    if (!name) return toast({ title: "Item name required", variant: "destructive" });
    createMutation.mutate({ name, category, unit, quantity, low_stock_threshold: threshold, cost_price: costPrice, supplier: supplier || null, notes: itemNotes || null });
  }

  function handleMovement() {
    if (!moveOpen) return;
    if (!moveQty || moveQty <= 0) return toast({ title: "Enter a quantity", variant: "destructive" });
    movementMutation.mutate({ stock_item_id: moveOpen.id, movement_type: moveType, quantity: moveQty, notes: moveNotes || null });
  }

  function exportCsv() {
    const rows = [
      ["Name", "Category", "Quantity", "Unit", "Low Stock Alert", "Cost Price (£)", "Total Value (£)", "Supplier", "Status"],
      ...filtered.map((i) => [
        i.name, i.category, i.quantity, i.unit, i.low_stock_threshold,
        i.cost_price.toFixed(2),
        (i.quantity * i.cost_price).toFixed(2),
        i.supplier || "",
        i.quantity <= i.low_stock_threshold ? "LOW STOCK" : "OK",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Stock-List.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = items.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (lowOnly && i.quantity > i.low_stock_threshold) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.supplier?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lowCount = items.filter((i) => i.quantity <= i.low_stock_threshold).length;
  const totalValue = items.reduce((s, i) => s + i.quantity * (i.cost_price || 0), 0);
  const totalItems = items.length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Stock & Inventory"
        subtitle="Track consumables, products, and parts across all your work"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#b1306f]/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-[#b1306f]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-lg font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${lowCount > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <AlertTriangle className={`h-5 w-5 ${lowCount > 0 ? "text-red-500" : "text-green-500"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low Stock</p>
              <p className={`text-lg font-bold ${lowCount > 0 ? "text-red-600" : ""}`}>{lowCount} items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock Value</p>
              <p className="text-lg font-bold">{formatGBP(totalValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert banner */}
      {lowCount > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-800 font-medium">{lowCount} item{lowCount > 1 ? "s are" : " is"} running low and need{lowCount === 1 ? "s" : ""} reordering.</span>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-red-200 text-red-700 hover:bg-red-100" onClick={() => setLowOnly(true)}>
            Show low stock only
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search items or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {lowOnly && (
          <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setLowOnly(false)}>
            Show all
          </Button>
        )}
        <Button variant="outline" className="ml-auto" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">{items.length === 0 ? "No stock items yet" : "No items match your filters"}</p>
          <p className="text-sm mt-1">{items.length === 0 ? "Add consumables, products, or parts you use in your work" : ""}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Cost Price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isLow = item.quantity <= item.low_stock_threshold;
                return (
                  <TableRow key={item.id} className={isLow ? "bg-red-50/40" : ""}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">{item.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold tabular-nums ${isLow ? "text-red-600" : ""}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.cost_price > 0 ? formatGBP(item.cost_price) : "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{item.cost_price > 0 ? formatGBP(item.quantity * item.cost_price) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.supplier || "—"}</TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge className="text-[11px] bg-red-100 text-red-700 border-0 flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" /> Low stock
                        </Badge>
                      ) : (
                        <Badge className="text-[11px] bg-green-100 text-green-700 border-0">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => { setMoveType("in"); setMoveOpen(item); }}
                          title="Add stock"
                        >
                          <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> In
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-orange-700 border-orange-200 hover:bg-orange-50"
                          onClick={() => { setMoveType("out"); setMoveOpen(item); }}
                          title="Use stock"
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Out
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm(`Remove "${item.name}" from stock?`)) deleteMutation.mutate(item.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Stock Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Item Name *</label>
              <Input placeholder="e.g. 1ml Hyaluronic Acid Filler, 22mm Copper Pipe, HEPA Filter" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {category && <p className="text-[11px] text-muted-foreground mt-1">{CATEGORY_EXAMPLES[category]}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Unit</label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Current Quantity</label>
                <Input type="number" min="0" step="0.5" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Low Stock Alert At</label>
                <Input type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
                <p className="text-[11px] text-muted-foreground mt-1">Alert when quantity drops to this</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cost Price (£)</label>
                <Input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Supplier</label>
                <Input placeholder="e.g. Derma Supplies Ltd" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Part numbers, reorder links, storage instructions..." value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Add to Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      {moveOpen && (
        <Dialog open={!!moveOpen} onOpenChange={(o) => { if (!o) { setMoveOpen(null); setMoveQty(1); setMoveNotes(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{moveType === "in" ? "Add Stock" : "Use Stock"} — {moveOpen.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="flex gap-3">
                <Button
                  variant={moveType === "in" ? "default" : "outline"}
                  className={`flex-1 ${moveType === "in" ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={() => setMoveType("in")}
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2" /> Stock In
                </Button>
                <Button
                  variant={moveType === "out" ? "default" : "outline"}
                  className={`flex-1 ${moveType === "out" ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                  onClick={() => setMoveType("out")}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" /> Stock Out
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Quantity ({moveOpen.unit}) — Currently {moveOpen.quantity}
                </label>
                <Input type="number" min="0.5" step="0.5" value={moveQty} onChange={(e) => setMoveQty(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notes (optional)</label>
                <Input
                  placeholder={moveType === "in" ? "e.g. Delivery from supplier" : "e.g. Used on Mrs Smith treatment"}
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setMoveOpen(null)}>Cancel</Button>
                <Button
                  className={`flex-1 ${moveType === "in" ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}
                  onClick={handleMovement}
                  disabled={movementMutation.isPending}
                >
                  {movementMutation.isPending ? "Saving..." : moveType === "in" ? "Add Stock" : "Use Stock"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
