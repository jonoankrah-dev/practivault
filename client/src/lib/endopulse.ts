export const ENDO_PULSE_BRAND_NAME = "endoPulse";

export type EndopulseTreatmentLike = {
  name?: string | null;
  is_endopulse?: boolean | null;
  service_brand?: string | null;
  service_line?: string | null;
};

export function isEndopulseTreatment(treatment: EndopulseTreatmentLike | null | undefined): boolean {
  if (!treatment) return false;
  return treatment.is_endopulse === true || /endopulse/i.test(treatment.name ?? "");
}

export function endoPulseTreatmentLabel(treatment: EndopulseTreatmentLike | null | undefined): string | null {
  return isEndopulseTreatment(treatment) ? "endoPulse treatment" : null;
}
