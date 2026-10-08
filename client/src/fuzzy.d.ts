// `fuzzy` (npm) ships no TypeScript types and has no @types/fuzzy package -
// this declares only the two exports this app actually calls.
declare module "fuzzy" {
  export interface FuzzyMatchResult {
    rendered: string;
    score: number;
  }

  export interface FuzzyMatchOptions {
    pre?: string;
    post?: string;
    caseSensitive?: boolean;
  }

  export function match(pattern: string, str: string, opts?: FuzzyMatchOptions): FuzzyMatchResult | null;
}
