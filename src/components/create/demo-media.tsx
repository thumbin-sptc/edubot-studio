"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { CreateMedia } from "@/lib/create/model";

export function DemoMedia({ media, title }: { media: CreateMedia; title: string }) {
  const descriptionId = useId();
  const [failed, setFailed] = useState(false);
  const [stillFailed, setStillFailed] = useState(false);
  const [playingGif, setPlayingGif] = useState(false);
  const still = media.stillPath && !stillFailed
    ? <Image src={media.stillPath} alt="" width={640} height={360} unoptimized onError={() => setStillFailed(true)} />
    : null;

  return (
    <figure className="create-demo">
      {media.kind === "video" && !failed && (
        <video src={media.path} controls muted loop playsInline preload="metadata"
          poster={media.stillPath} aria-label={`${title} 시연 영상`} aria-describedby={descriptionId}
          onError={() => setFailed(true)}>
          {media.captionsPath && <track kind="captions" label="한국어" srcLang="ko" src={media.captionsPath} />}
        </video>
      )}
      {media.kind === "gif" && !failed && (
        <>
          {playingGif
            ? <Image src={media.path} alt={`${title} 시연`} width={640} height={360} unoptimized onError={() => setFailed(true)} />
            : still}
          <button type="button" className="action action-secondary" onClick={() => setPlayingGif(!playingGif)}>
            {playingGif ? "시연 정지" : "시연 재생"}
          </button>
        </>
      )}
      {failed && (
        <>
          {still}
          <p role="status">시연을 불러오지 못했습니다. 아래의 텍스트 안내를 확인해 주세요.</p>
        </>
      )}
      <figcaption id={descriptionId}>{media.fallbackText}</figcaption>
    </figure>
  );
}
