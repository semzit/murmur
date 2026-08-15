const UNSAFE_KEYWORDS = [
  "assault rifle",
  "rifle",
  "revolver",
  "syringe",
  "chain saw",
  "chainsaw",
  "cleaver",
  "missile",
  "projectile",
  "cannon",
  "mortar",
  "guillotine",
  "holster",
];

export interface ModerationVerdict {
  verdict: "safe" | "unsafe";
  matchedClass?: string;
}

/** Maps an ImageNet classification label to a moderation verdict. */
export function moderateLabel(label: string): ModerationVerdict {
  const lower = label.toLowerCase();
  for (const keyword of UNSAFE_KEYWORDS) {
    if (lower.includes(keyword)) return { verdict: "unsafe", matchedClass: keyword };
  }
  return { verdict: "safe" };
}
