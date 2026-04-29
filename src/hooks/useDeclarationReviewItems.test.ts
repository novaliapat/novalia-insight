import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// --- Mock Supabase client (factory hoistée — pas de variables externes) ---
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

  const updateSpy = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));
  const invokeSpy = vi.fn();
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [itemsRow], error: null }),
    update: updateSpy,
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
      functions: { invoke: invokeSpy },
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    },
    __spies: { updateSpy, invokeSpy },
  };
});

// Récupération des spies exposés par le mock (typés en any, dédiés au test)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as supabaseModule from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const spies = (supabaseModule as any).__spies as { updateSpy: ReturnType<typeof vi.fn>; invokeSpy: ReturnType<typeof vi.fn> };

import { useDeclarationReviewItems } from "./useDeclarationReviewItems";

describe("useDeclarationReviewItems", () => {
  beforeEach(() => {
    spies.updateSpy.mockClear();
    spies.invokeSpy.mockReset();
  });

  it("charge les items au montage", async () => {
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0].id).toBe("item-1");
    expect(result.current.counts.pending).toBe(1);
  });

  it("markResolved appelle l'edge function update-review-item (et pas .update direct)", async () => {
    spies.invokeSpy.mockResolvedValue({
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

    expect(spies.invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "resolve", note: undefined },
    });
    expect(spies.updateSpy).not.toHaveBeenCalled();
    expect(result.current.items[0].status).toBe("resolved");
  });

  it("markIgnored → action ignore", async () => {
    spies.invokeSpy.mockResolvedValue({
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
    expect(spies.invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "ignore", note: undefined },
    });
    expect(spies.updateSpy).not.toHaveBeenCalled();
  });

  it("reopen → action reopen", async () => {
    spies.invokeSpy.mockResolvedValue({
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
    expect(spies.invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "reopen", note: undefined },
    });
  });

  it("setNote → action update_note avec note transmise", async () => {
    spies.invokeSpy.mockResolvedValue({
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
    expect(spies.invokeSpy).toHaveBeenCalledWith("update-review-item", {
      body: { reviewItemId: "item-1", action: "update_note", note: "ok" },
    });
    expect(result.current.items[0].note).toBe("ok");
    expect(spies.updateSpy).not.toHaveBeenCalled();
  });

  it("propage les erreurs de l'edge function", async () => {
    spies.invokeSpy.mockResolvedValue({ data: null, error: { message: "Accès refusé" } });
    const { result } = renderHook(() => useDeclarationReviewItems("decl-1"));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    await expect(
      act(async () => {
        await result.current.markResolved(result.current.items[0]);
      }),
    ).rejects.toThrow("Accès refusé");
  });
});
