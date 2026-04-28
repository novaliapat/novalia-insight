import type { ExtractedData } from "../schemas/extractedDataSchema";
import type { FiscalAnalysis } from "../schemas/fiscalAnalysisSchema";

/** Données mockées pour développer le parcours sans IA */

export const MOCK_EXTRACTED: ExtractedData = {
  taxpayer: {
    fullName: "Jean Dupont",
    fiscalNumber: "1234567890123",
    taxHousehold: "Marié, 2 parts",
  },
  taxYear: 2024,
  detectedCategories: ["ifu", "scpi", "life_insurance"],
  ifu: [
    {
      institution: "Banque Populaire",
      accountNumber: "FR76 ****",
      dividends: { value: 3420, confidence: "high", sourceDocument: "IFU_BP_2024.pdf" },
      interests: { value: 215, confidence: "high", sourceDocument: "IFU_BP_2024.pdf" },
      withholdingTax: { value: 410, confidence: "high", sourceDocument: "IFU_BP_2024.pdf" },
      socialContributions: { value: 620, confidence: "high", sourceDocument: "IFU_BP_2024.pdf" },
    },
  ],
  scpi: [
    {
      scpiName: "Épargne Pierre",
      managementCompany: "Atland Voisin",
      frenchIncome: { value: 4850, confidence: "high", sourceDocument: "SCPI_2024.pdf" },
      foreignIncome: { value: 1280, confidence: "medium", sourceDocument: "SCPI_2024.pdf", note: "Allemagne" },
      socialContributions: { value: 745, confidence: "high" },
    },
  ],
  lifeInsurance: [
    {
      contractName: "Linxea Avenir 2",
      insurer: "Spirica",
      contractAge: "more_than_8",
      withdrawals: { value: 12000, confidence: "high", sourceDocument: "AV_releve.pdf" },
      taxableShare: { value: 1850, confidence: "medium", sourceDocument: "AV_releve.pdf" },
    },
  ],
  warnings: [
    "Revenus étrangers détectés — convention fiscale à vérifier",
  ],
  missingData: [
    "Justificatif définitif des prélèvements sociaux SCPI manquant",
  ],
  globalConfidence: "high",
};

export const MOCK_ANALYSIS: FiscalAnalysis = {
  summary:
    "Vous percevez des revenus mobiliers (dividendes, intérêts), des revenus de SCPI (dont une part étrangère) et avez effectué un rachat partiel sur un contrat d'assurance-vie de plus de 8 ans. Trois formulaires sont concernés.",
  taxYear: 2024,
  analyzedCategories: ["ifu", "scpi", "life_insurance"],
  taxForms: ["2042", "2044", "2047"],
  taxCases: [
    {
      id: "tc1",
      category: "ifu",
      form: "2042",
      box: "2DC",
      label: "Dividendes éligibles à l'abattement de 40%",
      amount: 3420,
      explanation:
        "Dividendes d'actions reportables en case 2DC pour bénéficier de l'abattement de 40% si option pour le barème.",
      confidence: "high",
      ragSources: [
        {
          category: "ifu",
          documentTitle: "BOFIP — Dividendes & PFU",
          reference: "BOI-RPPM-RCM-20-10-20-50",
          excerpt: "Les dividendes ouvrent droit à un abattement de 40%...",
          relevanceScore: 0.92,
        },
      ],
      sourceDocument: "IFU_BP_2024.pdf",
      requiresManualReview: false,
    },
    {
      id: "tc2",
      category: "ifu",
      form: "2042",
      box: "2CK",
      label: "Crédit d'impôt prélèvement forfaitaire",
      amount: 410,
      explanation: "Crédit d'impôt correspondant au PFU de 12,8% déjà prélevé à la source.",
      confidence: "high",
      ragSources: [
        {
          category: "ifu",
          documentTitle: "Notice 2042",
          reference: "Notice 2042 §2CK",
          relevanceScore: 0.88,
        },
      ],
      requiresManualReview: false,
    },
    {
      id: "tc3",
      category: "scpi",
      form: "2044",
      box: "Ligne 211",
      label: "Revenus fonciers SCPI France",
      amount: 4850,
      explanation:
        "Quote-part de revenus fonciers issus de SCPI françaises à reporter au régime réel sur la 2044.",
      confidence: "high",
      ragSources: [
        {
          category: "scpi",
          documentTitle: "Guide SCPI — fiscalité",
          reference: "BOI-RFPI-CHAMP-30",
          relevanceScore: 0.9,
        },
      ],
      sourceDocument: "SCPI_2024.pdf",
      requiresManualReview: false,
    },
    {
      id: "tc4",
      category: "scpi",
      form: "2047",
      box: "Section IV",
      label: "Revenus fonciers étrangers (Allemagne)",
      amount: 1280,
      explanation:
        "Revenus fonciers de source allemande, à reporter en 2047 puis 2042 case 8TK selon la convention.",
      confidence: "medium",
      ragSources: [
        {
          category: "scpi",
          documentTitle: "Convention fiscale France-Allemagne",
          reference: "Art. 3 — Revenus immobiliers",
          relevanceScore: 0.74,
        },
      ],
      warning: "Vérifier le mode d'élimination de la double imposition selon convention.",
      requiresManualReview: false,
    },
    {
      id: "tc5",
      category: "life_insurance",
      form: "2042",
      box: "2CH",
      label: "Produits d'assurance-vie > 8 ans (abattement)",
      amount: 1850,
      explanation:
        "Part imposable des produits du rachat partiel, contrat de plus de 8 ans : abattement annuel de 4 600 € (9 200 € pour un couple).",
      confidence: "medium",
      ragSources: [],
      sourceDocument: "AV_releve.pdf",
      warning: "Aucune source RAG pertinente n'a été trouvée pour cette case.",
      requiresManualReview: true,
    },
  ],
  amountsByCategory: [
    { category: "ifu", totalAmount: 3830, caseCount: 2 },
    { category: "scpi", totalAmount: 6130, caseCount: 2 },
    { category: "life_insurance", totalAmount: 1850, caseCount: 1 },
  ],
  warnings: [
    "Les revenus étrangers nécessitent une attention particulière sur la méthode de neutralisation.",
    "L'option PFU vs barème doit être étudiée globalement sur le foyer.",
  ],
  uncertaintyPoints: [
    "Application exacte de l'abattement 4 600 €/9 200 € sur l'assurance-vie selon la situation conjugale.",
  ],
  requiredDocuments: [
    "IFU 2024 — Banque Populaire",
    "Relevé annuel SCPI Épargne Pierre",
    "Justificatif rachat assurance-vie Linxea Avenir 2",
  ],
  finalChecklist: [
    "Vérifier le report exact des montants dans la déclaration en ligne",
    "Conserver les justificatifs au minimum 3 ans",
    "Comparer option PFU et option barème avant validation",
  ],
  limitations:
    "Cette analyse repose sur les données validées. Elle ne remplace ni un conseil personnalisé ni la consultation de l'administration fiscale.",
};
