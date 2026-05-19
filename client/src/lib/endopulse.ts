export const ENDOPULSE_BRAND_NAME = "EndoPulse";

export type EndoPulseTreatmentLike = {
  name?: string | null;
  is_endopulse?: boolean | null;
  service_brand?: string | null;
  service_line?: string | null;
};

export function isEndoPulseTreatment(treatment: EndoPulseTreatmentLike | null | undefined): boolean {
  if (!treatment) return false;
  return treatment.is_endopulse === true || /endopulse/i.test(treatment.name ?? "");
}

export function endoPulseTreatmentLabel(treatment: EndoPulseTreatmentLike | null | undefined): string | null {
  return isEndoPulseTreatment(treatment) ? "EndoPulse treatment" : null;
}
