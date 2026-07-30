/**
 * Format a WhatsApp web deep-link URL (wa.me) for sending instant messages / statements.
 */
export function getWhatsAppShareUrl(mobile: string | null | undefined, message: string): string {
  const encodedMsg = encodeURIComponent(message);
  if (!mobile || !mobile.trim()) {
    return `https://wa.me/?text=${encodedMsg}`;
  }

  // Strip non-digit characters
  const clean = mobile.replace(/\D/g, "");
  // Assume Indian country code 91 if 10-digit number is passed
  const formattedMobile = clean.length === 10 ? `91${clean}` : clean;

  return `https://wa.me/${formattedMobile}?text=${encodedMsg}`;
}
