import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalDisclaimer } from "@/components/layout/LegalDisclaimer";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { ExtractedData } from "@/lib/declaration/schemas/extractedDataSchema";
import { ExtractedDataSchema } from "@/lib/declaration/schemas/extractedDataSchema";
import { toast } from "sonner";

interface Props {
  data: ExtractedData;
  onValidated: (data: ExtractedData) => void;
  onPrev: () => void;
}

export const ManualValidationStep = ({ data, onValidated, onPrev }: Props) => {
  const [draft, setDraft] = useState<ExtractedData>(structuredClone(data));

  const updateIFU = (idx: number, field: "dividends" | "interests" | "withholdingTax", value: string) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setDraft((d) => {
      const next = structuredClone(d);
      const entry = next.ifu[idx];
      if (entry[field]) entry[field]!.value = num;
      return next;
    });
  };

type SCPIConfidentField =
  | "frenchIncome"
  | "foreignIncome"
  | "grossIncome"
  | "expenses"
  | "scpiLoanInterests"
  | "netIncome"
  | "exemptIncome"
  | "foreignTaxCredit"
  | "rcmInterests"
  | "rcmCsgDeductible"
  | "rcmWithholdingTax"
  | "capitalGains"
  | "numberOfShares";

  const updateSCPI = (idx: number, field: SCPIConfidentField, value: string) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setDraft((d) => {
      const next = structuredClone(d);
      const entry = next.scpi[idx] as Record<string, { value: number } | undefined> & typeof next.scpi[number];
      const f = (entry as Record<string, { value: number } | undefined>)[field];
      if (f) f.value = num;
      return next;
    });
  };

  const updateSCPIIfi = (idx: number, value: string) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setDraft((d) => {
      const next = structuredClone(d);
      next.scpi[idx].ifiValuePerShare = { value: num, confidence: next.scpi[idx].ifiValuePerShare?.confidence ?? "medium" } as typeof next.scpi[idx].ifiValuePerShare;
      return next;
    });
  };

  const updateLoan = (idx: number, field: "bank" | "annualInterests" | "principal", value: string) => {
    setDraft((d) => {
      const next = structuredClone(d);
      const loans = next.loans ?? [];
      const entry = loans[idx];
      if (!entry) return next;
      if (field === "bank") {
        entry.bank = value;
      } else {
        const num = value === "" ? 0 : Number(value);
        if (Number.isNaN(num)) return next;
        if (field === "annualInterests") {
          entry.annualInterests.value = num;
        } else if (field === "principal" && entry.principal) {
          entry.principal.value = num;
        }
      }
      next.loans = loans;
      return next;
    });
  };

  const updateAV = (idx: number, value: string) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num)) return;
    setDraft((d) => {
      const next = structuredClone(d);
      const entry = next.lifeInsurance[idx];
      if (entry.taxableShare) entry.taxableShare.value = num;
      return next;
    });
  };

  const handleValidate = () => {
    const result = ExtractedDataSchema.safeParse(draft);
    if (!result.success) {
      toast.error("Données invalides");
      return;
    }
    onValidated(result.data);
    toast.success("Données validées");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Vérifiez et corrigez vos données</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          L'analyse fiscale ne sera lancée qu'après validation. Tous les montants restent modifiables.
        </p>
      </div>

      {draft.ifu.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-4">IFU</h3>
          <div className="space-y-4">
            {draft.ifu.map((entry, i) => (
              <div key={i} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                <div className="font-medium text-sm">{entry.institution}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {entry.dividends && (
                    <div>
                      <Label className="text-xs">Dividendes (€)</Label>
                      <Input
                        type="number"
                        value={entry.dividends.value}
                        onChange={(e) => updateIFU(i, "dividends", e.target.value)}
                      />
                    </div>
                  )}
                  {entry.interests && (
                    <div>
                      <Label className="text-xs">Intérêts (€)</Label>
                      <Input
                        type="number"
                        value={entry.interests.value}
                        onChange={(e) => updateIFU(i, "interests", e.target.value)}
                      />
                    </div>
                  )}
                  {entry.withholdingTax && (
                    <div>
                      <Label className="text-xs">PFU prélevé (€)</Label>
                      <Input
                        type="number"
                        value={entry.withholdingTax.value}
                        onChange={(e) => updateIFU(i, "withholdingTax", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {draft.scpi.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-4">SCPI</h3>
          <div className="space-y-4">
            {draft.scpi.map((entry, i) => (
              <div key={i} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                <div className="font-medium text-sm">{entry.scpiName}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entry.frenchIncome && (
                    <div>
                      <Label className="text-xs">Revenus France (€)</Label>
                      <Input
                        type="number"
                        value={entry.frenchIncome.value}
                        onChange={(e) => updateSCPI(i, "frenchIncome", e.target.value)}
                      />
                    </div>
                  )}
                  {entry.foreignIncome && (
                    <div>
                      <Label className="text-xs">Revenus étrangers (€)</Label>
                      <Input
                        type="number"
                        value={entry.foreignIncome.value}
                        onChange={(e) => updateSCPI(i, "foreignIncome", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {draft.lifeInsurance.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold mb-4">Assurance-vie</h3>
          <div className="space-y-4">
            {draft.lifeInsurance.map((entry, i) => (
              <div key={i} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                <div className="font-medium text-sm">{entry.contractName}</div>
                {entry.taxableShare && (
                  <div>
                    <Label className="text-xs">Part imposable (€)</Label>
                    <Input
                      type="number"
                      value={entry.taxableShare.value}
                      onChange={(e) => updateAV(i, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <LegalDisclaimer compact />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Button onClick={handleValidate} size="lg" className="gap-2">
          <CheckCircle2 className="h-4 w-4" /> Valider les données
        </Button>
      </div>
    </div>
  );
};
