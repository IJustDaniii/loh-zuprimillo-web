import type { Member, SessionView } from "../shared/contracts";

export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  SESSION_TTL_DAYS: string;
  BOOTSTRAP_TOKEN?: string;
}

export interface AppVariables {
  member: Member;
  session: SessionView;
  csrfHash: string;
}

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
