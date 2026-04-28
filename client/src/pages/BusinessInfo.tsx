/**
 * BusinessInfo — Business profile page
 * Stores products/services, social links, and FAQs for Safi to use
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, Globe, Instagram, Youtube, Facebook,
  Plus, Pencil, Trash2, Loader2, Save, HelpCircle,
  ShoppingBag, Music2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface BusinessInfoData {
  id?: string;
  tagline?: string;
  about?: string;
  logo_url?: string;
  website_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  facebook_url?: string;
  youtube_url?: string;
  products: Product[];
  faqs: Faq[];
}

const EMPTY_INFO: BusinessInfoData = {
  tagline: "", about: "", logo_url: "",
  website_url: "", instagram_url: "", tiktok_url: "",
  facebook_url: "", youtube_url: "",
  products: [], faqs: [],
};

// (no default products — each business adds their own)

// ── Helper ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

// ── Product Dialog ────────────────────────────────────────────────────────────
function ProductDialog({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Product | null;
  onSave: (p: Product) => void;
}) {
  const [form, setForm] = useState<Product>(
    initial ?? { id: uid(), name: "", description: "", price: "", category: "" }
  );
  useEffect(() => {
    setForm(initial ?? { id: uid(), name: "", description: "", price: "", category: "" });
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Product / Service" : "Add Product / Service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs mb-1.5 block">Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nose Slimming Course" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Price</Label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. £499.00" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. CPD Course" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What's included, who it's for, key benefits…"
              rows={4}
              className="resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#E83A8E] hover:bg-[#c42d77] text-white"
            disabled={!form.name.trim()}
            onClick={() => { onSave(form); onClose(); }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── FAQ Dialog ────────────────────────────────────────────────────────────────
function FaqDialog({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Faq | null;
  onSave: (f: Faq) => void;
}) {
  const [form, setForm] = useState<Faq>(initial ?? { id: uid(), question: "", answer: "" });
  useEffect(() => {
    setForm(initial ?? { id: uid(), question: "", answer: "" });
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs mb-1.5 block">Question *</Label>
            <Input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="e.g. Do courses include a certificate?" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Answer *</Label>
            <Textarea
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="Safi will use this to answer clients…"
              rows={4}
              className="resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#E83A8E] hover:bg-[#c42d77] text-white"
            disabled={!form.question.trim() || !form.answer.trim()}
            onClick={() => { onSave(form); onClose(); }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BusinessInfo() {
  const { toast } = useToast();
  const [productDialog, setProductDialog] = useState<{ open: boolean; item?: Product | null }>({ open: false });
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; item?: Faq | null }>({ open: false });

  const { data: info, isLoading } = useQuery<BusinessInfoData>({
    queryKey: ["/api/business-info"],
  });

  const [form, setForm] = useState<BusinessInfoData>(EMPTY_INFO);

  useEffect(() => {
    if (info) setForm(info);
  }, [info]);

  const saveMutation = useMutation({
    mutationFn: (data: BusinessInfoData) => apiRequest("POST", "/api/business-info", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-info"] });
      toast({ title: "Business info saved", description: "Safi is up to date." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => saveMutation.mutate(form);

  // Products
  const saveProduct = (p: Product) => {
    setForm(f => {
      const exists = f.products.find(x => x.id === p.id);
      return {
        ...f,
        products: exists
          ? f.products.map(x => x.id === p.id ? p : x)
          : [...f.products, p],
      };
    });
  };
  const deleteProduct = (id: string) =>
    setForm(f => ({ ...f, products: f.products.filter(x => x.id !== id) }));

  // FAQs
  const saveFaq = (faq: Faq) => {
    setForm(f => {
      const exists = f.faqs.find(x => x.id === faq.id);
      return {
        ...f,
        faqs: exists
          ? f.faqs.map(x => x.id === faq.id ? faq : x)
          : [...f.faqs, faq],
      };
    });
  };
  const deleteFaq = (id: string) =>
    setForm(f => ({ ...f, faqs: f.faqs.filter(x => x.id !== id) }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categoryColour = (cat: string) => {
    if (cat === "CPD Course") return "bg-[#E83A8E]/10 text-[#E83A8E] border-[#E83A8E]/20";
    if (cat === "Medical Equipment") return "bg-teal-50 text-teal-700 border-teal-200";
    if (cat === "Wellness Product") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Business Info"
        subtitle="Everything Safi needs to represent your business perfectly"
        actions={
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-[#E83A8E] hover:bg-[#c42d77] text-white"
            data-testid="button-save-business-info"
          >
            {saveMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Save className="h-4 w-4 mr-2" />
            }
            Save Changes
          </Button>
        }
      />

      {/* ── Section 1: Business Details ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#E83A8E]" />
            Business Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">Tagline</Label>
            <Input
              value={form.tagline ?? ""}
              onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              placeholder="e.g. Premium CPD courses for aesthetic professionals"
              data-testid="input-tagline"
            />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">About the Business</Label>
            <Textarea
              value={form.about ?? ""}
              onChange={e => setForm(f => ({ ...f, about: e.target.value }))}
              placeholder="A short paragraph about your business — who you are, what you offer, your ethos…"
              rows={4}
              className="resize-none text-sm"
              data-testid="input-about"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Website & Socials ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#E83A8E]" />
            Website & Socials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
                <Globe className="h-3.5 w-3.5" /> Website
              </Label>
              <Input
                value={form.website_url ?? ""}
                onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                placeholder="https://yourwebsite.com"
                data-testid="input-website"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </Label>
              <Input
                value={form.instagram_url ?? ""}
                onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))}
                placeholder="https://instagram.com/yourbusiness"
                data-testid="input-instagram"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
                <Music2 className="h-3.5 w-3.5" /> TikTok
              </Label>
              <Input
                value={form.tiktok_url ?? ""}
                onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value }))}
                placeholder="https://tiktok.com/@yourbusiness"
                data-testid="input-tiktok"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
                <Facebook className="h-3.5 w-3.5" /> Facebook
              </Label>
              <Input
                value={form.facebook_url ?? ""}
                onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))}
                placeholder="https://facebook.com/yourbusiness"
                data-testid="input-facebook"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
                <Youtube className="h-3.5 w-3.5" /> YouTube
              </Label>
              <Input
                value={form.youtube_url ?? ""}
                onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                placeholder="https://youtube.com/@yourbusiness"
                data-testid="input-youtube"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Products & Services ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[#E83A8E]" />
              Products & Services
              <Badge variant="outline" className="text-xs font-normal ml-1">{form.products.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setProductDialog({ open: true, item: null })}
                className="bg-[#E83A8E] hover:bg-[#c42d77] text-white text-xs"
                data-testid="button-add-product"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {form.products.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No products yet.</p>
              <p className="text-xs mt-1">Add your products and services so Safi can answer client questions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {form.products.map((p, i) => (
                <div key={p.id}>
                  <div className="flex items-start justify-between gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{p.name}</span>
                        {p.price && (
                          <span className="text-xs font-semibold text-[#E83A8E]">{p.price}</span>
                        )}
                        {p.category && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", categoryColour(p.category))}>
                            {p.category}
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setProductDialog({ open: true, item: p })}
                        data-testid={`button-edit-product-${p.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteProduct(p.id)}
                        data-testid={`button-delete-product-${p.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {i < form.products.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: FAQs ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#E83A8E]" />
              Key FAQs
              <Badge variant="outline" className="text-xs font-normal ml-1">{form.faqs.length}</Badge>
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setFaqDialog({ open: true, item: null })}
              className="bg-[#E83A8E] hover:bg-[#c42d77] text-white text-xs"
              data-testid="button-add-faq"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {form.faqs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No FAQs yet.</p>
              <p className="text-xs mt-1">Add questions Safi should know how to answer.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {form.faqs.map((faq, i) => (
                <div key={faq.id}>
                  <div className="flex items-start justify-between gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{faq.question}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setFaqDialog({ open: true, item: faq })}
                        data-testid={`button-edit-faq-${faq.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteFaq(faq.id)}
                        data-testid={`button-delete-faq-${faq.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {i < form.faqs.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ProductDialog
        open={productDialog.open}
        initial={productDialog.item}
        onClose={() => setProductDialog({ open: false })}
        onSave={saveProduct}
      />
      <FaqDialog
        open={faqDialog.open}
        initial={faqDialog.item}
        onClose={() => setFaqDialog({ open: false })}
        onSave={saveFaq}
      />
    </div>
  );
}
