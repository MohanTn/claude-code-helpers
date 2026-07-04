import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
/**
 * Architecture hint rule from config/architecture-hints.json
 */
export interface ArchitectureHint {
  glob: string;
  hint: string;
}

/**
 * Port of the original match-glob.js with identical semantics.
 * Converts glob patterns to regex, then tests against the given file path
 * relative to the working directory and as an absolute path.
 */
export function loadHints(configPath: string): ArchitectureHint[] {
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  return raw.rules as ArchitectureHint[];
}

function globToRegExp(glob: string): RegExp {
  let s = glob.split("**/").join(" DOUBLESTAR_SLASH ");
  s = s.split("**").join(" DOUBLESTAR ");
  s = s.split("*").join(" STAR ");
  s = s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  s = s.split(" DOUBLESTAR_SLASH ").join("(?:.*/)?");
  s = s.split(" DOUBLESTAR ").join(".*");
  s = s.split(" STAR ").join("[^/]*");
  return new RegExp(`^${s}$`);
}

export function matchHint(
  rules: ArchitectureHint[],
  filePath: string,
  cwd: string
): string | null {
  const rel = relative(cwd, filePath);
  for (const rule of rules) {
    const re = globToRegExp(rule.glob);
    if (re.test(rel) || re.test(filePath)) {
      return rule.hint;
    }
  }
  return null;
}
