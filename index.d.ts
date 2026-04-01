// Type declarations for the Semiclaw Code CLI package
// This provides TypeScript definitions for the distributed module

export interface SemiclawCodeOptions {
  apiKey?: string;
  apiUrl?: string;
  verbose?: boolean;
}

export function runSemiclawCode(
  options?: SemiclawCodeOptions,
): Promise<void>;
