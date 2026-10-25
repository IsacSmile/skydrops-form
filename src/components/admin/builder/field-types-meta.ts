import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  ChevronDown,
  CheckCircle2,
  CheckSquare,
  Calendar,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import type { FieldType } from "@/types/form";
import { isOptionFieldType, isTextLikeFieldType } from "@/lib/field-validation";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  description: string;
  icon: LucideIcon;
  isOptionType: boolean;
  isTextLike: boolean;
}

export const FIELD_TYPES_META: Record<FieldType, FieldTypeMeta> = {
  short_text: {
    type: "short_text",
    label: "Short text",
    description: "Single-line response, names, titles",
    icon: Type,
    isOptionType: false,
    isTextLike: true,
  },
  long_text: {
    type: "long_text",
    label: "Long text",
    description: "Multi-line paragraphs, comments, feedback",
    icon: AlignLeft,
    isOptionType: false,
    isTextLike: true,
  },
  email: {
    type: "email",
    label: "Email",
    description: "Validated email address",
    icon: Mail,
    isOptionType: false,
    isTextLike: true,
  },
  phone: {
    type: "phone",
    label: "Phone",
    description: "Phone number with international support",
    icon: Phone,
    isOptionType: false,
    isTextLike: true,
  },
  number: {
    type: "number",
    label: "Number",
    description: "Numeric quantities, ratings, ages",
    icon: Hash,
    isOptionType: false,
    isTextLike: true,
  },
  dropdown: {
    type: "dropdown",
    label: "Dropdown",
    description: "Select one option from a dropdown menu",
    icon: ChevronDown,
    isOptionType: true,
    isTextLike: false,
  },
  radio: {
    type: "radio",
    label: "Multiple choice (radio)",
    description: "Choose one single option among visible choices",
    icon: CheckCircle2,
    isOptionType: true,
    isTextLike: false,
  },
  checkbox: {
    type: "checkbox",
    label: "Checkboxes",
    description: "Select one or more choices from a list",
    icon: CheckSquare,
    isOptionType: true,
    isTextLike: false,
  },
  date: {
    type: "date",
    label: "Date",
    description: "Calendar date picker",
    icon: Calendar,
    isOptionType: false,
    isTextLike: false,
  },
  file: {
    type: "file",
    label: "File upload",
    description: "Respondents will upload a file (set up later)",
    icon: UploadCloud,
    isOptionType: false,
    isTextLike: false,
  },
};

export const ORDERED_FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkbox",
  "date",
  "file",
];

export function getFieldTypeMeta(type: FieldType): FieldTypeMeta {
  return (
    FIELD_TYPES_META[type] ?? {
      type,
      label: type,
      description: "",
      icon: Type,
      isOptionType: isOptionFieldType(type),
      isTextLike: isTextLikeFieldType(type),
    }
  );
}
