/**
 * DataClient — the platform's single data-access contract.
 *
 * Both the API and the seed/import tools depend on this interface, never on Firestore
 * directly. Two implementations exist:
 *  - FirestoreDataClient  (production; requires Firebase Admin credentials)
 *  - InMemoryDataClient   (development/tests; explicit mock mode, never allowed in production)
 *
 * Transactions: `runTransaction` gives read-your-writes semantics with all writes applied
 * atomically at commit time. Callers must use it for stock changes and payment state changes.
 */
import type { BaseDoc } from "@annaadhya/contracts";

export type WhereOp = "==" | "in" | "<" | "<=" | ">" | ">=";

export interface WhereClause {
  field: string;
  op: WhereOp;
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction?: "asc" | "desc";
}

export interface QueryOptions {
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

export interface TransactionClient {
  get<T>(col: string, id: string): Promise<T | null>;
  /** Queue a partial update (applied on commit). */
  update(col: string, id: string, patch: Record<string, unknown>): void;
  /** Queue a full-document set (id required, applied on commit). */
  set(col: string, id: string, data: Record<string, unknown>): void;
  /** Queue a create with a fresh id; the id is returned immediately and applied on commit. */
  create(col: string, data: Record<string, unknown>): string;
  delete(col: string, id: string): void;
}

export interface CreateMeta {
  isDemo?: boolean;
  seedBatch?: string;
  /** Provide a stable id (required for idempotent imports/seed); default generated. */
  id?: string;
  /** Override timestamps (epoch millis) — used by seed/import to keep records stable. */
  createdAt?: number;
  updatedAt?: number;
}

export interface DataClient {
  readonly providerName: "memory" | "firestore";
  get<T>(col: string, id: string): Promise<T | null>;
  getMany<T>(col: string, ids: string[]): Promise<Map<string, T>>;
  list<T>(col: string, opts?: QueryOptions): Promise<T[]>;
  count(col: string, where?: WhereClause[]): Promise<number>;
  create<T extends object>(col: string, data: T, meta?: CreateMeta): Promise<T & BaseDoc>;
  set<T extends object>(col: string, id: string, data: T, meta?: CreateMeta): Promise<T & BaseDoc>;
  update<T extends object>(col: string, id: string, patch: Partial<T>): Promise<T>;
  delete(col: string, id: string): Promise<void>;
  runTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
  /** Bulk load used by seed/reset tools (fast path). */
  bulkSet(col: string, docs: ({ id: string } & object)[]): Promise<void>;
  /** Bulk delete used by demo reset (only for explicitly-identified demo records). */
  bulkDelete(col: string, ids: string[]): Promise<void>;
  /** Stats snapshot for health checks. */
  stats(): Promise<{ provider: string; collections: Record<string, number> }>;
}
