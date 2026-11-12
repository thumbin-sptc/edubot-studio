export const platforms = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" } as const;
export const devices = { "desktop-web": "PC 웹", "mobile-web": "모바일 웹" } as const;
export type Platform = keyof typeof platforms;
export type Device = keyof typeof devices;

export const schoolLevels = ["유치원", "초등학교", "중학교", "고등학교", "전공과"] as const;
export const environments = ["특수학급", "특수학교"] as const;
export const personalizationFields = {
  schoolLevel: "학교급",
  environment: "교육 환경",
  classDescription: "익명화한 학급 구성",
  educationFocus: "중요하게 생각하는 교육 방향",
  extraRequests: "추가 요청",
} as const;

export type Personalization = Partial<Record<keyof typeof personalizationFields, string>>;
export type Combination = { platform: Platform; device: Device };
export type VerifiedNote = { text: string; verifiedAt: string };
export type Instruction = { id: string; version: string; sha256: string; coreInstruction: string };
export type Knowledge = {
  id: string;
  title: string;
  description: string;
  path: string;
  category: "common" | "optional";
  recommendedFor?: { schoolLevels?: string[]; environments?: string[] };
  verifiedAt: string;
  fileSize: number;
  fileVersion: string;
  platformNotes?: Partial<Record<Platform, VerifiedNote>>;
};
export type CreateMedia = {
  kind: "video" | "gif";
  path: string;
  fallbackText: string;
  stillPath?: string;
  captionsPath?: string;
};
export type CreateAction =
  | { kind: "instruction" | "knowledge" }
  | { kind: "external-link"; label: string; url: string; verifiedAt: string };
export type CreateStep = {
  id: string;
  title: string;
  description: string;
  media: CreateMedia;
  actions: CreateAction[];
  checkLabel: string;
  desktopAlternative?: string;
  mascot?: { path: string; text: string };
};
export type CompletionKind = "role" | "knowledge" | "personalization";
export type CompletionCheck = { kind: CompletionKind; prompt: string; criteria: string; stepId: string };
type Entry = Combination & { id: string; version: string; verifiedAt: string };
export type UnsupportedEntry = Entry & { support: "unsupported"; reason: string };
export type PublishedGuide = Entry & {
  support: "supported";
  instruction: Instruction;
  resources: Knowledge[];
  steps: CreateStep[];
  checks: CompletionCheck[];
};
export type PublishedCreateEntry = UnsupportedEntry | PublishedGuide;
export type CreateStatus = Combination & (
  | { status: "published" }
  | { status: "unsupported"; reason: string; verifiedAt: string }
);

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && Object.hasOwn(platforms, value);
}

export function isDevice(value: unknown): value is Device {
  return typeof value === "string" && Object.hasOwn(devices, value);
}

export function createHref({ platform, device }: Combination) {
  return `/create/${platform}/${device}`;
}
