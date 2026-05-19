export function isWhatsAppEnabled(): boolean {
  const v = import.meta.env.VITE_WHATSAPP_ENABLED;
  return v === "true" || v === "1";
}
