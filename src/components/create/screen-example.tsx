"use client";

import { Expand, ImageOff } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { ScreenExample } from "@/lib/create/model";
import { publicAssetUrl } from "@/lib/site-path";

export function ScreenExamplePanel({ example }: { example?: ScreenExample }) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const caption = useRef<HTMLElement>(null);
  const titleId = useId();
  const detailId = useId();
  const src = example && publicAssetUrl(example.path);
  const description = example?.focusText ?? "따라 하기 설명에서 필요한 기능과 확인할 위치를 찾아보세요.";

  return (
    <figure className="create-demo create-screen-example">
      <figcaption ref={caption} tabIndex={-1}>
        <strong>예시 화면</strong>
        {example && <span> · 확인일 {example.verifiedAt}</span>}
      </figcaption>
      {example && src && !failed ? (
        <>
          <Image src={src} alt={example.alt} width={960} height={600} onError={() => setFailed(true)} />
          <button className="action action-secondary" type="button" ref={opener}
            aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
            <Expand size={17} aria-hidden="true" /> 예시 화면 확대
          </button>
        </>
      ) : (
        <p className="create-screen-unavailable" role={failed ? "status" : undefined}>
          <ImageOff size={20} aria-hidden="true" />
          {failed ? "예시 화면을 불러오지 못했어요. 따라 하기 설명을 확인해 주세요."
            : "실제 예시 화면은 검수 중이에요."}
        </p>
      )}
      <div className="create-screen-focus">
        <strong>이 화면에서 확인할 것</strong>
        <p>{description}</p>
      </div>
      {src && example && (
        <dialog className="create-screen-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={detailId}
          onClose={() => (opener.current ?? caption.current)?.focus()}>
          <div className="create-screen-dialog-header">
            <h3 id={titleId}>예시 화면 확대</h3>
            <button type="button" className="action action-secondary" onClick={() => dialog.current?.close()}>닫기</button>
          </div>
          {!failed && <Image src={src} alt={example.alt} width={1440} height={900} onError={() => setFailed(true)} />}
          <p id={detailId}>{failed ? "이미지를 열지 못했어요. " : ""}{description}</p>
        </dialog>
      )}
    </figure>
  );
}
