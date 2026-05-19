/** Feature flags — set VITE_WHATSAPP_ENABLED=true in .env when Twilio WhatsApp is live. */
export function isWhatsAppEnabled(): boolean {
  const v = import.meta.env.VITE_WHATSAPP_ENABLED;
  return v === "true" || v === "1";
}
