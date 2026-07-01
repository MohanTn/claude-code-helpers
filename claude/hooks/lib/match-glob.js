// .claude/hooks/lib/match-glob.js
const fs = require("fs");
const path = require("path");

const [, , rulesPath, filePath] = process.argv;
const { rules } = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

function globToRegExp(glob) {
  // "**/" must become an optional any-depth prefix ("(?:.*/)?"), not a bare
  // ".*" sandwiched between literal slashes — otherwise a pattern like
  // "**/components/**/*.tsx" fails to match a direct child such as
  // "components/Foo.tsx" (no nested subdirectory), since the literal "/"
  // baked into the glob between the second "**" and "*.tsx" would still be
  // required even when that "**" matches zero directories.
  let s = glob.split("**/").join(" DOUBLESTAR_SLASH ");
  s = s.split("**").join(" DOUBLESTAR ");
  s = s.split("*").join(" STAR ");
  s = s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  s = s.split(" DOUBLESTAR_SLASH ").join("(?:.*/)?");
  s = s.split(" DOUBLESTAR ").join(".*");
  s = s.split(" STAR ").join("[^/]*");
  return new RegExp(`^${s}$`);
}

const rel = path.relative(process.cwd(), filePath);
for (const rule of rules) {
  if (globToRegExp(rule.glob).test(rel) || globToRegExp(rule.glob).test(filePath)) {
    process.stdout.write(rule.hint);
    process.exit(0);
  }
}
