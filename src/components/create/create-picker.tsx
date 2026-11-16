"use client";

import Link from "next/link";
import { updateCreateSession, useCreateSession } from "@/lib/create/browser-session";
import { createHref, devices, platforms, type CreateStatus, type Device, type Platform } from "@/lib/create/model";
import { CreateStorageControls } from "./create-storage-controls";

export function CreatePicker({ statuses }: { statuses: CreateStatus[] }) {
  const { session } = useCreateSession();
  const { platform, device } = session.selection;
  const combination = platform && device ? { platform, device } : undefined;
  const selected = statuses.find((entry) => entry.platform === platform && entry.device === device);
  const desktop = statuses.some((entry) => entry.platform === platform && entry.device === "desktop-web" && entry.status === "published");

  return (
    <section className="info-panel create-picker" aria-label="플랫폼과 기기 선택">
      <fieldset>
        <legend>AI 플랫폼</legend>
        <div className="create-options create-platforms">
          {(Object.entries(platforms) as Array<[Platform, string]>).map(([key, label]) => (
            <label key={key}>
              <input type="radio" name="create-platform" checked={platform === key}
                onChange={() => updateCreateSession((current) => ({ ...current, selection: { ...current.selection, platform: key } }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={!platform}>
        <legend>이용 기기</legend>
        <div className="create-options">
          {(Object.entries(devices) as Array<[Device, string]>).map(([key, label]) => {
            const status = statuses.find((entry) => entry.platform === platform && entry.device === key)?.status;
            return (
              <label key={key}>
                <input type="radio" name="create-device" checked={device === key}
                  onChange={() => updateCreateSession((current) => ({ ...current, selection: { ...current.selection, device: key } }))} />
                <span>{label}</span>
                {platform && (
                  <span className={status === "published" ? "step-complete" : "create-badge"}>
                    {status === "published" ? "안내 보기" : status === "unsupported" ? "미지원" : "준비 중"}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="create-selection" aria-live="polite">
        {combination && selected?.status === "published" && (
          <Link href={createHref(combination)} className="action">제작 안내 시작</Link>
        )}
        {combination && selected?.status === "unsupported" && (
          <>
            <p>{platforms[combination.platform]} {devices[combination.device]} · 미지원</p>
            <p>{selected.reason} (확인일 {selected.verifiedAt})</p>
            {combination.device === "mobile-web" && desktop && (
              <Link href={createHref({ platform: combination.platform, device: "desktop-web" })}
                className="create-text-link">PC 웹 제작 안내 보기</Link>
            )}
          </>
        )}
      </div>
      <CreateStorageControls showPreference={false} />
    </section>
  );
}
