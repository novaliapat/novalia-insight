import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// --- Mock Supabase client ---
const updateSpy = vi.fn();
const invokeSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const itemsRow = {
    id: "item-1",
    declaration_id: "decl-1",
    audit_log_id: null,
    source_type: "consistency_issue",
    source_code: "MISSING",
    severity: "warning",
    field: "ifu",
    message: "Vérifier l'IFU",
    status: "pending",
    note: null,
    dedup_key: "consistency:MISSING:ifu",
    created_at: "2026-04-29T10:00:00.000Z",
    updated_at: "2026-04-29T10:00:00.000Z",
  };

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [itemsRow], error: null }),
    update: updateSpy.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
      functions: { invoke: invokeSpy },
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    },
  };
});

import { useDeclarationReviewItems } from "./useDeclarationReviewItems";

describe("useDeclarationReviewItems", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    invokeSpy.mockReset();
  });

  it("charge les items au montage", async () => {
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].id).toBe("item-1");
    expect(result.current.counts.pending).toBe(1);
  });

  it("markResolved appelle l'edge function update-review-item (et pas .update direct)", async () => {
    invokeSpy.mockResolvedValue({
      data: {
        ok: true,
        reviewItem: { id: "item-1", declaration_id: "decl-1", status: "resolved", note: null },
        declarationReviewStatus: "review_completed",
      },
      error: null,
    });

    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));

    await act(async () => {
      await result.current.markResolved(result.current.items[0]);
    });

    expect(invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "resolve", note: undefined },
    });
    // Aucun .update direct sur la table
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.current.items[0].status).toBe("resolved");
  });

  it("markIgnored → action ignore", async () => {
    invokeSpy.mockResolvedValue({
      data: {
        ok: true,
        reviewItem: { id: "item-1", declaration_id: "decl-1", status: "ignored", note: null },
        declarationReviewStatus: "review_partially_ignored",
      },
      error: null,
    });
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    await act(async () => {
      await result.current.markIgnored(result.current.items[0]);
    });
    expect(invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "ignore", note: undefined },
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("reopen → action reopen", async () => {
    invokeSpy.mockResolvedValue({
      data: {
        ok: true,
        reviewItem: { id: "item-1", declaration_id: "decl-1", status: "pending", note: null },
        declarationReviewStatus: "review_pending",
      },
      error: null,
    });
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    await act(async () => {
      await result.current.reopen(result.current.items[0]);
    });
    expect(invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "reopen", note: undefined },
    });
  });

  it("setNote → action update_note avec note transmise", async () => {
    invokeSpy.mockResolvedValue({
      data: {
        ok: true,
        reviewItem: { id: "item-1", declaration_id: "decl-1", status: "pending", note: "ok" },
        declarationReviewStatus: "review_pending",
      },
      error: null,
    });
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    await act(async () => {
      await result.current.setNote(result.current.items[0], "ok");
    });
    expect(invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "update_note", note: "ok" },
    });
    expect(result.current.items[0].note).toBe("ok");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("propage les erreurs de l'edge function", async () => {
    invokeSpy.mockResolvedValue({ data: null, error: { message: "Accès refusé" } });
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    await expect(
      act(async () => {
        await result.current.markResolved(result.current.items[0]);
      }),
    ).rejects.toThrow("Accès refusé");
  });
});
