import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Loader2, BookPlus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ingestRagDocument } from "@/lib/rag/ragClient";
import { RAG_LIBRARIES } from "@/lib/rag/ragCategories";
import type { TaxCategory } from "@/lib/declaration/contracts/extractedDataContract";
import { BROCHURE_IR_2025_SEED } from "@/lib/rag/seed/brochureIr2025Seed";
import { supabase } from "@/integrations/supabase/client";

const RagAdmin = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaxCategory>("ifu");
  const [taxYear, setTaxYear] = useState<string>("");
  const [sourceType, setSourceType] = useState("BOFIP");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isOfficial, setIsOfficial] = useState(true);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Titre et contenu sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const res = await ingestRagDocument({
        title: title.trim(),
        category,
        taxYear: taxYear ? Number(taxYear) : null,
        sourceType: sourceType.trim(),
        sourceName: sourceName.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        isOfficialSource: isOfficial,
        content,
      });
      toast.success(`Document ingéré (${res.chunksCreated} chunks)`);
      setTitle("");
      setContent("");
      setSourceUrl("");
    } catch (e) {
      toast.error((e as Error).message ?? "Erreur lors de l'ingestion");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8 max-w-3xl">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-smooth">Tableau de bord</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Admin RAG fiscal</span>
        </nav>

        <Card className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <BookPlus className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Ajouter une source fiscale RAG
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Le contenu sera découpé en chunks puis indexé dans la bibliothèque catégorielle correspondante.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BOFIP Dividendes 2024" />
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaxCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(RAG_LIBRARIES).map((lib) => (
                    <SelectItem key={lib.category} value={lib.category}>
                      {lib.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="taxYear">Année fiscale</Label>
              <Input id="taxYear" type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} placeholder="2024" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceType">Type de source</Label>
              <Input id="sourceType" value={sourceType} onChange={(e) => setSourceType(e.target.value)} placeholder="BOFIP, Notice, Loi..." />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceName">Référence / nom</Label>
              <Input id="sourceName" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="BOI-RPPM-RCM-20-10" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="sourceUrl">URL</Label>
              <Input id="sourceUrl" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://bofip.impots.gouv.fr/..." />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="official" className="text-sm">Source officielle</Label>
                <p className="text-xs text-muted-foreground">Visible par tous les utilisateurs authentifiés.</p>
              </div>
              <Switch id="official" checked={isOfficial} onCheckedChange={setIsOfficial} />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="content">Contenu texte</Label>
              <Textarea
                id="content"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Coller ici le texte de référence (extrait BOFIP, notice, etc.)."
              />
              <p className="text-[11px] text-muted-foreground">
                Le contenu sera découpé en chunks d'environ 1000 caractères avec overlap.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={busy} className="gap-1">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Ingest
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default RagAdmin;
