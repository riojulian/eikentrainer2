export const qk = {
  words: () => ["words"] as const,
  statuses: (userId: string) => ["statuses", userId] as const,
  worldOrder: (userId: string, world: string) => ["worldOrder", userId, world] as const,
  currentWorld: (userId: string) => ["currentWorld", userId] as const,
  allStars: (userId: string) => ["allStars", userId] as const,
  worldStage: (userId: string, world: string) => ["worldStage", userId, world] as const,
  stats: (userId: string) => ["stats", userId] as const,
  badges: (userId: string) => ["badges", userId] as const,
  mastery: (userId: string) => ["mastery", userId] as const,
  starsByStage: (userId: string, world: string) => ["starsByStage", userId, world] as const,
};