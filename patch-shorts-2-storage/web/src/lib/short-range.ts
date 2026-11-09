// Reads the HTTP "Range" header of a video request (SHORTS_TODO 12). Pure function: no disk, no database.
// Browsers ask for pieces of a video ("bytes=0-", "bytes=500000-900000") so playing can start at once and the person can
// jump to any second. We answer one single range only (all a <video> element ever needs).

export type ByteRange = { start: number; end: number }; // both inclusive
export type RangeResult =
  | { kind: "none" } // no Range header (or one we do not understand): send the whole file
  | { kind: "ok"; range: ByteRange }
  | { kind: "unsatisfiable" }; // the asked part lies outside the file: answer 416

export function parseRange(header: string | null, size: number): RangeResult {
  if (!header) return { kind: "none" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { kind: "none" }; // several ranges, other units, rubbish: just send everything
  const [, a, b] = m;
  if (a === "" && b === "") return { kind: "none" };
  if (size <= 0) return { kind: "unsatisfiable" };

  let start: number;
  let end: number;
  if (a === "") {
    // "bytes=-500": the LAST 500 bytes
    const last = Number(b);
    if (!Number.isSafeInteger(last) || last <= 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - last);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return { kind: "unsatisfiable" };
    if (start >= size || end < start) return { kind: "unsatisfiable" };
  }
  return { kind: "ok", range: { start, end } };
}
