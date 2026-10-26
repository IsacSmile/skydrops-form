import {
  User,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Hash,
  MapPin,
  Globe,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type FieldIconName =
  | "user"
  | "building"
  | "briefcase"
  | "mail"
  | "phone"
  | "hash"
  | "map-pin"
  | "globe"
  | "bar-chart";

const RE_BUILDING =
  /\b(company|organi[sz]ation|business|firm|employer|institution|university|school)\b/i;
const RE_USER = /\b(name|contact person)\b/i;
const RE_BRIEFCASE =
  /\b(job|title|position|role|designation|occupation|department)\b/i;
const RE_MAP_PIN = /\b(country|city|state|location|address|region)\b/i;
const RE_GLOBE = /\b(website|url|link|site)\b/i;
const RE_BAR_CHART =
  /\b(interest|category|topic|industry|sector|service|product)\b/i;

/**
 * Pure function determining the automatic field icon name based on type and label.
 * Rules, first match wins:
 * 1. type email -> "mail"; phone -> "phone"; number -> "hash"
 * 2. type long_text, date, radio, checkbox, file -> null
 * 3. for short_text and dropdown, by label (company rule precedes name rule so "Company Name" gets "building"):
 *    company|organi[sz]ation|business|firm|employer|institution|university|school -> "building"
 *    name|contact person -> "user"
 *    job|title|position|role|designation|occupation|department -> "briefcase"
 *    country|city|state|location|address|region -> "map-pin"
 *    website|url|link|site -> "globe"
 *    interest|category|topic|industry|sector|service|product -> "bar-chart"
 * 4. otherwise null
 */
export function getFieldIconName(field: {
  type: string;
  label: string;
}): FieldIconName | null {
  const type = field.type;

  // Rule 1: Type-based match
  if (type === "email") return "mail";
  if (type === "phone") return "phone";
  if (type === "number") return "hash";

  // Rule 2: Explicit null types
  if (
    type === "long_text" ||
    type === "date" ||
    type === "radio" ||
    type === "checkbox" ||
    type === "file"
  ) {
    return null;
  }

  // Rule 3: For short_text and dropdown, inspect label (lowercased with word boundaries)
  if (type === "short_text" || type === "dropdown") {
    const label = (field.label || "").toLowerCase();

    // 1. Company / Organization (must precede name rule for "Company Name")
    if (RE_BUILDING.test(label)) return "building";

    // 2. Name / Contact person
    if (RE_USER.test(label)) return "user";

    // 3. Job / Title / Position / Department
    if (RE_BRIEFCASE.test(label)) return "briefcase";

    // 4. Location / Country / City / State / Address
    if (RE_MAP_PIN.test(label)) return "map-pin";

    // 5. Website / URL / Link
    if (RE_GLOBE.test(label)) return "globe";

    // 6. Interest / Category / Industry
    if (RE_BAR_CHART.test(label)) return "bar-chart";
  }

  // Rule 4: otherwise null
  return null;
}

export const FIELD_ICON_COMPONENTS: Record<FieldIconName, LucideIcon> = {
  user: User,
  building: Building2,
  briefcase: Briefcase,
  mail: Mail,
  phone: Phone,
  hash: Hash,
  "map-pin": MapPin,
  globe: Globe,
  "bar-chart": BarChart3,
};
