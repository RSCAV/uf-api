// Shared domain types for the UF Data SDK.

export type Season = "Fall" | "Spring" | "Summer";
export type DifficultyTier = "easy" | "medium" | "hard";

export interface PrereqGroup {
  group_id: number; // same group_id = OR, different group_id = AND
  prereq_code: string;
  min_grade?: string;
}

export interface Course {
  code: string;
  name: string;
  credits: number;
  offered: Season[];
  prereqs: string[];
  prereq_groups?: PrereqGroup[];
  coreqs: string[];
  description?: string;
  difficulty_tier?: DifficultyTier;
}
