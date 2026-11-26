const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return `${h ? ONES[h] + " Hundred" : ""}${h && rem ? " " : ""}${rem ? twoDigits(rem) : ""}`;
}

/** Spell out a rupee amount in Indian numbering (Lakhs / Crores). */
export function numberToIndianWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Rupees Zero Only";
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);

  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1_000);
  const rest = whole % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  const rupeeStr = parts.length > 0 ? parts.join(" ") : "Zero";
  if (paise > 0) {
    return `Rupees ${rupeeStr} and ${twoDigits(paise)} Paise Only`;
  }
  return `Rupees ${rupeeStr} Only`;
}

/** Format Indian vehicle registration numbers: hr26ab1234 -> HR-26-AB-1234 */
export function formatVehiclePlate(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = clean.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
  }
  return raw.toUpperCase();
}

/** Safely evaluate simple +/- arithmetic in amount fields (e.g. "500+1200-50"). */
export function evalMathExpression(raw: string): number | null {
  const cleaned = raw.replace(/\s+/g, "");
  if (!cleaned || !/^[0-9.+/-]+$/.test(cleaned)) return null;
  if (!/[+-]/.test(cleaned)) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const tokens = cleaned.match(/[+-]?[0-9.]+/g);
  if (!tokens) return null;
  let total = 0;
  for (const t of tokens) {
    const val = Number(t);
    if (!Number.isFinite(val)) return null;
    total += val;
  }
  return Math.round(total * 100) / 100;
}

/** Subtle Web Audio save chime + haptic vibration for forecourt tablets/phones. */
export function playSaveChime(enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(25);
    }
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore audio restrictions
  }
}
