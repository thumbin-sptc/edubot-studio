import { isRecord, parseInventoryMetadata, type ContentsOrder, type PromptCatalogMetadata, type PublishedPrompt } from "./prompt-template.ts";

export type PublishedPromptSummary = Readonly<PromptCatalogMetadata & {
  id: string;
  title: string;
  summary?: string;
}>;
export type CatalogView = "purpose" | "contents";
export type CatalogFilter = "category" | "schoolEnvironment" | "schoolLevel";
export type PublishedResultSource = Readonly<Pick<PublishedPrompt, "id" | "title" | "version">>;

const korean = new Intl.Collator("ko", { numeric: true });
const textbookPurposes = ["교육과정 설계·운영", "수업·활동 설계", "평가", "개별화교육계획(IEP)"];
export const catalogFilters: ReadonlyArray<{ field: CatalogFilter; label: string }> = [
  { field: "category", label: "활용 분야" },
  { field: "schoolEnvironment", label: "교육 환경" },
  { field: "schoolLevel", label: "학교급" },
];

export function indexInventory(raw: unknown) {
  const index = new Map<string, Record<string, unknown>>();
  if (!isRecord(raw) || !Array.isArray(raw.items)) return index;
  for (const item of raw.items) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (index.has(item.id)) throw new Error(`Duplicate inventory id: ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}

export function publicPromptSummary(template: PublishedPrompt, inventory?: Record<string, unknown>): PublishedPromptSummary {
  const fallback = inventory ? parseInventoryMetadata(inventory) : {};
  const verified = template.catalog;
  // Section and page numbers describe a specific source and cannot be borrowed across sources.
  const sameSource = !verified.source || verified.source === fallback.source;
  const sameSection = !verified.section || verified.section === fallback.section;
  return {
    id: template.id,
    title: template.title,
    summary: template.summary,
    category: verified.category ?? fallback.category,
    schoolEnvironment: verified.schoolEnvironment ?? fallback.schoolEnvironment,
    schoolLevel: verified.schoolLevel ?? fallback.schoolLevel,
    source: verified.source ?? fallback.source,
    section: verified.section ?? (sameSource ? fallback.section : undefined),
    pdfPage: verified.pdfPage ?? (sameSource && sameSection ? fallback.pdfPage : undefined),
    bookPage: verified.bookPage ?? (sameSource && sameSection ? fallback.bookPage : undefined),
    ...(verified.contentsOrder && { contentsOrder: verified.contentsOrder }),
    ...(verified.searchTags && { searchTags: verified.searchTags }),
  };
}

export function relatedPublicPrompts(template: PublishedPrompt, catalog: readonly PublishedPromptSummary[]) {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  return (template.relatedPromptIds ?? []).flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [{ id: entry.id, title: entry.title }] : [];
  });
}

export function approvedResultSources(template: PublishedPrompt, published: readonly PublishedPrompt[]) {
  const byId = new Map(published.map((entry) => [entry.id, entry]));
  return template.previousResultImports.map(({ fieldId, sourcePromptIds }) => ({
    fieldId,
    sources: sourcePromptIds.flatMap((id): PublishedResultSource[] => {
      const source = byId.get(id);
      return source ? [{ id: source.id, title: source.title, version: source.version }] : [];
    }),
  }));
}

export function catalogOptions(entries: readonly PublishedPromptSummary[], field: CatalogFilter) {
  return [...new Set(entries.flatMap((entry) => entry[field] ? [entry[field]] : []))].sort(korean.compare);
}

function searchable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/gu, "");
}

export function filterCatalog(
  entries: readonly PublishedPromptSummary[],
  search: string,
  filters: Partial<Record<CatalogFilter, string>>,
) {
  const query = searchable(search);
  const terms = search.trim().split(/\s+/u).map(searchable).filter(Boolean);
  return entries.filter((entry) => {
    if (!catalogFilters.every(({ field }) => !filters[field] || filters[field] === entry[field])) return false;
    if (!query) return true;
    const metadata = [entry.title, entry.summary, entry.category, entry.source, entry.section,
      entry.schoolEnvironment, entry.schoolLevel, ...(entry.searchTags ?? []),
      entry.pdfPage ? `PDF ${entry.pdfPage}쪽` : undefined,
      entry.bookPage ? `교재 ${entry.bookPage}쪽` : undefined,
    ].flatMap((value) => value ? [searchable(value)] : []);
    return metadata.some((value) => value.includes(query)) ||
      terms.every((term) => metadata.some((value) => value.includes(term)));
  });
}

function byContentsOrder(left?: ContentsOrder, right?: ContentsOrder) {
  if (!left || !right) return Number(Boolean(right)) - Number(Boolean(left));
  return left.part - right.part || left.chapter - right.chapter || left.item - right.item;
}

function firstContentsOrder(entries: readonly PublishedPromptSummary[]) {
  return entries.reduce<ContentsOrder | undefined>((first, { contentsOrder }) =>
    byContentsOrder(contentsOrder, first) < 0 ? contentsOrder : first, undefined);
}

export function groupCatalog(entries: readonly PublishedPromptSummary[], field: "category" | "source" | "section") {
  const groups = new Map<string | undefined, PublishedPromptSummary[]>();
  for (const entry of entries) {
    const key = entry[field];
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups].sort(([left, leftItems], [right, rightItems]) => {
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    if (field !== "category") {
      return byContentsOrder(firstContentsOrder(leftItems), firstContentsOrder(rightItems)) || korean.compare(left, right);
    }
    const rank = (value: string) => (textbookPurposes.indexOf(value) + 1) || textbookPurposes.length + 1;
    return rank(left) - rank(right) || korean.compare(left, right);
  });
}

export function sortCatalog(entries: readonly PublishedPromptSummary[], view: CatalogView) {
  return [...entries].sort((left, right) =>
    (view === "contents" ? byContentsOrder(left.contentsOrder, right.contentsOrder) ||
      (left.bookPage ?? left.pdfPage ?? Infinity) - (right.bookPage ?? right.pdfPage ?? Infinity) : 0) ||
    korean.compare(left.title, right.title) || korean.compare(left.id, right.id),
  );
}
