import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  handleRequest,
  recomputeAndSaveReviewStatus,
  type AuditLogPayload,
  type AuthResolver,
  type ReviewItemRecord,
  type ReviewStore,
} from "./index.ts";
import type {
  DeclarationReviewStatus,
  ReviewItemStatus,
} from "../_shared/review/computeReviewStatus.ts";

// ---------------------------------------------------------------------------
// Fake store / auth
// ---------------------------------------------------------------------------

interface FakeState {
  items: Map<string, ReviewItemRecord>;
  declarations: Map<string, { user_id: string; review_status: DeclarationReviewStatus }>;
  auditLogs: AuditLogPayload[];
  itemsByDecl: Map<string, Set<string>>;
}

function makeState(): FakeState {
  return {
    items: new Map(),
    declarations: new Map(),
    auditLogs: [],
    itemsByDecl: new Map(),
  };
}

function addItem(state: FakeState, item: ReviewItemRecord) {
  state.items.set(item.id, { ...item });
  if (!state.itemsByDecl.has(item.declaration_id)) {
    state.itemsByDecl.set(item.declaration_id, new Set());
  }
  state.itemsByDecl.get(item.declaration_id)!.add(item.id);
}

function makeStore(state: FakeState): ReviewStore {
  return {
    async loadItem(id) {
      return state.items.get(id) ?? null;
    },
    async loadDeclarationOwner(declarationId) {
      const d = state.declarations.get(declarationId);
      return d ? { user_id: d.user_id } : null;
    },
    async updateItemStatus(id, status) {
      const it = state.items.get(id);
      if (it) it.status = status;
    },
    async updateItemNote(id, note) {
      const it = state.items.get(id);
      if (it) it.note = note;
    },
    async insertAuditLog(payload) {
      state.auditLogs.push(payload);
    },
    async listItemStatuses(declarationId) {
      const ids = state.itemsByDecl.get(declarationId) ?? new Set<string>();
      const statuses: ReviewItemStatus[] = [];
      for (const id of ids) {
        const it = state.items.get(id);
        if (it) statuses.push(it.status);
      }
      return statuses;
    },
    async updateDeclarationReviewStatus(declarationId, reviewStatus) {
      const d = state.declarations.get(declarationId);
      if (d) d.review_status = reviewStatus;
    },
  };
}

function makeAuth(userId: string | null): AuthResolver {
  return {
    async resolveUserId() {
      return userId;
    },
  };
}

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const DECL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ITEM_PENDING = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ITEM_RESOLVED = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function seed(): FakeState {
  const state = makeState();
  state.declarations.set(DECL, { user_id: USER, review_status: "no_review_needed" });
  addItem(state, {
    id: ITEM_PENDING,
    declaration_id: DECL,
    status: "pending",
    source_type: "consistency_issue",
    source_code: "MISSING_CATEGORY",
    field: "ifu",
    note: null,
  });
  addItem(state, {
    id: ITEM_RESOLVED,
    declaration_id: DECL,
    status: "resolved",
    source_type: "warning",
    source_code: null,
    field: null,
    note: null,
  });
  return state;
}

function buildRequest(body: unknown, opts: { auth?: string | null } = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== null) {
    headers["Authorization"] = opts.auth ?? "Bearer fake-token";
  }
  return new Request("http://localhost/update-review-item", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const FIXED_NOW = () => new Date("2026-04-29T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("resolve → item resolved + audit + review_status recalculé", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "resolve" }),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, true);
  assertEquals(json.reviewItem.status, "resolved");
  // Tous les items deviennent resolved → review_completed
  assertEquals(json.declarationReviewStatus, "review_completed");
  assertEquals(state.items.get(ITEM_PENDING)?.status, "resolved");
  assertEquals(state.declarations.get(DECL)?.review_status, "review_completed");
  assertEquals(state.auditLogs.length, 1);
  const log = state.auditLogs[0];
  assertEquals(log.action, "review_item_resolved");
  assertEquals(log.user_id, USER);
  assertEquals(log.declaration_id, DECL);
  assertEquals(log.metadata.review_item_id, ITEM_PENDING);
  assertEquals(log.metadata.previous_status, "pending");
  assertEquals(log.metadata.new_status, "resolved");
  assertEquals(log.metadata.source_type, "consistency_issue");
  assertEquals(log.metadata.source_code, "MISSING_CATEGORY");
  assertEquals(log.metadata.field, "ifu");
  assertEquals(log.metadata.has_note, false);
  assertEquals(log.metadata.updated_at, "2026-04-29T12:00:00.000Z");
});

Deno.test("ignore → item ignored + audit + review_partially_ignored", async () => {
  const state = seed();
  // resolved + ignored => partially_ignored (aucun pending)
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "ignore" }),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.reviewItem.status, "ignored");
  assertEquals(json.declarationReviewStatus, "review_partially_ignored");
  assertEquals(state.auditLogs[0].action, "review_item_ignored");
  assertEquals(state.auditLogs[0].metadata.previous_status, "pending");
  assertEquals(state.auditLogs[0].metadata.new_status, "ignored");
});

Deno.test("reopen → item pending + audit + review_pending", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_RESOLVED, action: "reopen" }),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.reviewItem.status, "pending");
  assertEquals(json.declarationReviewStatus, "review_pending");
  assertEquals(state.auditLogs[0].action, "review_item_reopened");
  assertEquals(state.auditLogs[0].metadata.previous_status, "resolved");
  assertEquals(state.auditLogs[0].metadata.new_status, "pending");
});

Deno.test("update_note → note mise à jour + statut inchangé + audit", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "update_note", note: "vérifié manuellement" }),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.reviewItem.note, "vérifié manuellement");
  assertEquals(json.reviewItem.status, "pending"); // inchangé
  assertEquals(state.items.get(ITEM_PENDING)?.note, "vérifié manuellement");
  assertEquals(state.auditLogs[0].action, "review_item_note_updated");
  assertEquals(state.auditLogs[0].metadata.has_note, true);
  // pending présent → review_pending
  assertEquals(json.declarationReviewStatus, "review_pending");
});

Deno.test("update_note avec note vide → normalisée en null + has_note=false", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "update_note", note: "   " }),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.reviewItem.note, null);
  assertEquals(state.auditLogs[0].metadata.has_note, false);
});

Deno.test("401 si pas de header Authorization", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER) };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "resolve" }, { auth: null }),
    deps,
  );
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("401 si token invalide", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(null) };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "resolve" }),
    deps,
  );
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("400 si reviewItemId invalide", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER) };
  const res = await handleRequest(
    buildRequest({ reviewItemId: "not-a-uuid", action: "resolve" }),
    deps,
  );
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("400 si action inconnue", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER) };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "delete" }),
    deps,
  );
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("404 si review item inexistant", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER) };
  const res = await handleRequest(
    buildRequest({
      reviewItemId: "deadbeef-dead-beef-dead-beefdeadbeef",
      action: "resolve",
    }),
    deps,
  );
  assertEquals(res.status, 404);
  await res.text();
});

Deno.test("403 si la déclaration appartient à un autre user", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(OTHER), now: FIXED_NOW };
  const res = await handleRequest(
    buildRequest({ reviewItemId: ITEM_PENDING, action: "resolve" }),
    deps,
  );
  assertEquals(res.status, 403);
  await res.text();
  // L'item ne doit PAS avoir bougé
  assertEquals(state.items.get(ITEM_PENDING)?.status, "pending");
  assertEquals(state.auditLogs.length, 0);
});

Deno.test("ne fait pas confiance au front pour declaration_id : ignore le champ injecté", async () => {
  const state = seed();
  // Une autre déclaration appartenant à OTHER
  const FAKE_DECL = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  state.declarations.set(FAKE_DECL, { user_id: OTHER, review_status: "no_review_needed" });
  const deps = { store: makeStore(state), auth: makeAuth(USER), now: FIXED_NOW };
  // L'attaquant injecte un declaration_id qui ne sera pas lu (le handler relit depuis l'item)
  const res = await handleRequest(
    buildRequest({
      reviewItemId: ITEM_PENDING,
      action: "resolve",
      declaration_id: FAKE_DECL,
      user_id: OTHER,
    } as unknown as Record<string, unknown>),
    deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  // Le declaration_id retourné est celui de l'item réel, pas celui injecté
  assertEquals(json.reviewItem.declaration_id, DECL);
  assertEquals(state.auditLogs[0].declaration_id, DECL);
  assertEquals(state.auditLogs[0].user_id, USER);
});

// ---------------------------------------------------------------------------
// Recalcul review_status — cas exhaustifs
// ---------------------------------------------------------------------------

Deno.test("recompute: aucun item → no_review_needed", async () => {
  const state = makeState();
  state.declarations.set(DECL, { user_id: USER, review_status: "review_pending" });
  const status = await recomputeAndSaveReviewStatus(makeStore(state), DECL);
  assertEquals(status, "no_review_needed");
  assertEquals(state.declarations.get(DECL)?.review_status, "no_review_needed");
});

Deno.test("recompute: au moins un pending → review_pending", async () => {
  const state = makeState();
  state.declarations.set(DECL, { user_id: USER, review_status: "no_review_needed" });
  addItem(state, { id: "x1", declaration_id: DECL, status: "pending", source_type: null, source_code: null, field: null, note: null });
  addItem(state, { id: "x2", declaration_id: DECL, status: "resolved", source_type: null, source_code: null, field: null, note: null });
  const status = await recomputeAndSaveReviewStatus(makeStore(state), DECL);
  assertEquals(status, "review_pending");
});

Deno.test("recompute: tous resolved → review_completed", async () => {
  const state = makeState();
  state.declarations.set(DECL, { user_id: USER, review_status: "no_review_needed" });
  addItem(state, { id: "x1", declaration_id: DECL, status: "resolved", source_type: null, source_code: null, field: null, note: null });
  addItem(state, { id: "x2", declaration_id: DECL, status: "resolved", source_type: null, source_code: null, field: null, note: null });
  const status = await recomputeAndSaveReviewStatus(makeStore(state), DECL);
  assertEquals(status, "review_completed");
});

Deno.test("recompute: ignored sans pending → review_partially_ignored", async () => {
  const state = makeState();
  state.declarations.set(DECL, { user_id: USER, review_status: "no_review_needed" });
  addItem(state, { id: "x1", declaration_id: DECL, status: "resolved", source_type: null, source_code: null, field: null, note: null });
  addItem(state, { id: "x2", declaration_id: DECL, status: "ignored", source_type: null, source_code: null, field: null, note: null });
  const status = await recomputeAndSaveReviewStatus(makeStore(state), DECL);
  assertEquals(status, "review_partially_ignored");
});

Deno.test("OPTIONS → 204 CORS", async () => {
  const state = seed();
  const deps = { store: makeStore(state), auth: makeAuth(USER) };
  const res = await handleRequest(
    new Request("http://localhost/", { method: "OPTIONS" }),
    deps,
  );
  assert(res.status === 200 || res.status === 204);
  await res.text();
});
