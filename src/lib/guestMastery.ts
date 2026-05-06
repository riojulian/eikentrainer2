import { supabase } from "@/integrations/supabase/client";
import type { Mastery } from "@/lib/words";

export const GUEST_FREE_STAGES = 3;
export const GUEST_FREE_WORLD = "tier1";
const STORAGE_KEY = "eikentrainer_guest_mastery";

type GuestMastery = Record<string, Mastery>;

function safeRead(): GuestMastery {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as GuestMastery;
  } catch {
    return {};
  }
}

export function getGuestMastery(): GuestMastery {
  return safeRead();
}

export function getGuestMasteryForWord(wordId: string): Mastery | null {
  const m = safeRead()[wordId];
  return m === undefined ? null : m;
}

export function setGuestMasteryForWord(wordId: string, mastery: Mastery): void {
  if (typeof window === "undefined") return;
  const current = safeRead();
  current[wordId] = mastery;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function clearGuestMastery(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isGuestAllowed(world: string, stage: number | undefined): boolean {
  if (world !== GUEST_FREE_WORLD) return false;
  if (stage === undefined) return true;
  return stage >= 1 && stage <= GUEST_FREE_STAGES;
}

export async function migrateGuestMasteryToSupabase(userId: string): Promise<void> {
  const mastery = safeRead();
  const entries = Object.entries(mastery);
  if (entries.length === 0) return;
  const rows = entries.map(([word_id, m]) => ({
    student_id: userId,
    word_id,
    mastery: m,
    updated_at: new Date().toISOString(),
  }));
  await supabase
    .from("word_status")
    .upsert(rows, { onConflict: "word_id,student_id" });
  clearGuestMastery();
}