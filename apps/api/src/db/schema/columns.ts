import { timestamp } from "drizzle-orm/pg-core";

/** `timestamptz` read and written as `Date`. */
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
