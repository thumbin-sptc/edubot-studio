"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { ActionLink } from "@/components/action-link";
import {
  catalogFilters, catalogOptions, filterCatalog, groupCatalog, sortCatalog,
  type CatalogFilter, type CatalogView, type PublishedPromptSummary,
} from "@/lib/prompt-catalog";

const views = [
  { id: "purpose", label: "활용 목적별" },
  { id: "contents", label: "교재 목차별" },
] as const;

function CatalogCards({ entries }: { entries: readonly PublishedPromptSummary[] }) {
  return (
    <ul className="catalog-cards">
      {entries.map(({ id, title, summary, category, schoolEnvironment, schoolLevel, source, section, pdfPage, bookPage }) => {
        const tags = [...new Set([category, schoolEnvironment, schoolLevel].filter(Boolean))];
        const location = [source, section, bookPage && `교재 ${bookPage}쪽`, pdfPage && `PDF ${pdfPage}쪽`].filter(Boolean);
        return (
          <li key={id} className="info-panel catalog-card">
            <strong>{title}</strong>
            {summary && <p>{summary}</p>}
            {tags.length > 0 && <p className="catalog-tags">{tags.join(" · ")}</p>}
            {location.length > 0 && <p className="catalog-location">수록 위치 · {location.join(" / ")}</p>}
            <div className="catalog-card-action"><ActionLink href={`/prompts/${id}`}>{title} 작성하기</ActionLink></div>
          </li>
        );
      })}
    </ul>
  );
}

function CatalogGroups({ entries, view }: { entries: PublishedPromptSummary[]; view: CatalogView }) {
  const groups = groupCatalog(sortCatalog(entries, view), view === "purpose" ? "category" : "source");
  return groups.map(([name, items]) => (
    <section className="catalog-group" key={name ?? "@unknown"}>
      <h2>{name ?? (view === "purpose" ? "분류 미표기" : "수록 위치 미표기")} <span>{items.length}건</span></h2>
      {view === "purpose" || !name ? <CatalogCards entries={items} /> : (
        groupCatalog(items, "section").map(([section, results]) => (
          <div className="catalog-section" key={section ?? "@unknown"}>
            {section && <h3>{section}</h3>}
            <CatalogCards entries={results} />
          </div>
        ))
      )}
    </section>
  ));
}

export function PromptCatalog({ entries }: { entries: readonly PublishedPromptSummary[] }) {
  const id = useId();
  const [view, setView] = useState<CatalogView>("purpose");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Partial<Record<CatalogFilter, string>>>({});
  const results = filterCatalog(entries, search, filters);
  const active = Boolean(search.trim() || Object.values(filters).some(Boolean));
  const tabId = (tab: CatalogView) => `${id}-${tab}`;
  const panelId = (tab: CatalogView) => `${tabId(tab)}-panel`;

  function selectTab(event: KeyboardEvent<HTMLButtonElement>) {
    const position = views.findIndex(({ id }) => id === view);
    const next = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1
      : event.key === "ArrowLeft" || event.key === "ArrowRight" ? (position + 1) % views.length : -1;
    if (next === -1) return;
    event.preventDefault();
    setView(views[next].id);
    document.getElementById(tabId(views[next].id))?.focus();
  }

  return (
    <div className="catalog">
      <div className="catalog-tabs" role="tablist" aria-label="프롬프트 탐색 방식">
        {views.map(({ id: tab, label }) => (
          <button key={tab} type="button" id={tabId(tab)} role="tab" aria-controls={panelId(tab)}
            aria-selected={view === tab} tabIndex={view === tab ? 0 : -1}
            onClick={() => setView(tab)} onKeyDown={selectTab}>{label}</button>
        ))}
      </div>
      <section className="info-panel catalog-search" aria-label="프롬프트 검색 및 필터">
        <label htmlFor={`${id}-search`}>프롬프트 검색</label>
        <input id={`${id}-search`} type="search" className="prompt-input" value={search}
          autoComplete="off" spellCheck={false} onChange={(event) => setSearch(event.target.value)} />
        <div className="catalog-filters">
          {catalogFilters.map(({ field, label }) => {
            const options = catalogOptions(entries, field);
            return options.length > 0 && (
              <label key={field}>
                {label}
                <select className="prompt-input" value={filters[field] ?? ""}
                  onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}>
                  <option value="">전체</option>
                  {options.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            );
          })}
        </div>
        <div className="catalog-search-footer">
          <p role="status">{results.length}건{!active && " · 검색 및 필터 조건 없음"}</p>
          <button className="action action-secondary" type="button" disabled={!active}
            onClick={() => { setSearch(""); setFilters({}); }}>검색·필터 초기화</button>
        </div>
      </section>
      {views.map(({ id: tab }) => (
        <div key={tab} role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}
          hidden={tab !== view} tabIndex={0}>
          {tab === view && (results.length
            ? <CatalogGroups entries={results} view={view} />
            : <p className="info-panel">조건에 맞는 프롬프트가 없습니다. 검색어나 필터를 바꿔 보세요.</p>)}
        </div>
      ))}
    </div>
  );
}
