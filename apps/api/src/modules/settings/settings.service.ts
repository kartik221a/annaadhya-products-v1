/** Global settings singleton with safe defaults (seeded when missing). */
import { Injectable } from "@nestjs/common";
import { COLLECTIONS, type SettingsDoc } from "@annaadhya/contracts";
import type { DataClient } from "@annaadhya/data-core";
import { defaultSettings } from "@annaadhya/data-core";

const SETTINGS_ID = "global";

@Injectable()
export class SettingsService {
  constructor(private readonly data: DataClient) {}

  async get(): Promise<SettingsDoc> {
    const doc = await this.data.get<SettingsDoc>(COLLECTIONS.settings, SETTINGS_ID);
    if (doc) return doc;
    const created = await this.data.set(COLLECTIONS.settings, SETTINGS_ID, defaultSettings(), {
      isDemo: false,
    });
    return created as unknown as SettingsDoc;
  }

  async update(patch: DeepPartial<SettingsDoc>): Promise<SettingsDoc> {
    const current = await this.get();
    const merged = deepMerge(current, patch) as SettingsDoc;
    merged.updatedAt = Date.now();
    return (await this.data.set(
      COLLECTIONS.settings,
      SETTINGS_ID,
      merged as object,
      { isDemo: false },
    )) as unknown as SettingsDoc;
  }
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) || Array.isArray(patch) || typeof base !== "object" || typeof patch !== "object") {
    return patch as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = deepMerge((base as Record<string, unknown>)[k], v as DeepPartial<unknown>);
  }
  return out as T;
}
