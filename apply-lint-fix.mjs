// apply-lint-fix.mjs — fixes the 2 lint findings. Run from the 7-mayktop folder:  node apply-lint-fix.mjs
// Safe to run twice. Makes .bak copies.
import fs from "node:fs";

function edit(file, oldText, newText, doneMarker) {
  if (!fs.existsSync(file)) { console.error(file + ": not found (run from the 7-mayktop folder)"); process.exit(1); }
  const s = fs.readFileSync(file, "utf8");
  if (s.includes(doneMarker)) { console.log(file + ": already done"); return; }
  if (!s.includes(oldText)) { console.error(file + ": expected text not found. Nothing changed."); process.exit(1); }
  fs.copyFileSync(file, file + ".bak");
  fs.writeFileSync(file, s.replace(oldText, newText));
  console.log(file + ": updated");
}

// 1) ref must not be written during render -> write it in an effect
edit(
  "web/src/components/photos/PhotoUploadForm.tsx",
  "  itemsRef.current = items;\n",
  "  useEffect(() => {\n    itemsRef.current = items;\n  }, [items]);\n",
  "itemsRef.current = items;\n  }, [items]);"
);

// 2) unused eslint-disable directive (warning)
edit(
  "web/src/lib/place-input.ts",
  "// eslint-disable-next-line no-control-regex -- control characters are exactly what we refuse\nconst CONTROL_RE",
  "// control characters are exactly what we refuse\nconst CONTROL_RE",
  "// control characters are exactly what we refuse\nconst CONTROL_RE"
);
console.log("Done. Now: cd web && npm run lint && npm run build");
