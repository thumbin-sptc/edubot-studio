import type { ReactNode } from "react";
import { publicAssetUrl } from "@/lib/site-path";
import type { Knowledge } from "@/lib/create/model";
import { knowledgePathBasename } from "@/lib/create/zip-policy";

export function KnowledgeDownloadHelp() {
  return (
    <p className="muted">
      브라우저에 따라 파일이 열리거나 내부 이름으로 저장될 수 있습니다.
      파일이 열리면 다른 이름으로 저장하고, 내부 이름으로 받았다면 표시된 원본 이름으로 바꿔 주세요.
      파일명과 저장 완료 여부는 브라우저의 다운로드 목록에서 확인해 주세요.
    </p>
  );
}

export function KnowledgeDownloadLinks({ file, onStart, details }: {
  file: Pick<Knowledge, "title" | "path" | "originalFilename">;
  onStart?: (name: string) => void;
  details?: ReactNode;
}) {
  const internalName = knowledgePathBasename(file.path);
  if (!internalName) return null;
  const href = publicAssetUrl(file.path);
  return (
    <div className="create-download-links">
      {!details && <p className="create-download-title">{file.title}</p>}
      <div className="flex flex-wrap gap-2">
        <a className="action action-secondary" href={href} download={file.originalFilename}
          aria-label={`${file.title} 다운로드`}
          onClick={() => onStart?.(file.originalFilename)}>다운로드</a>
        {file.originalFilename !== internalName && (
          <a className="action action-secondary" href={href} download={internalName}
            aria-label={`${file.title} 내부 이름으로 받기`}
            onClick={() => onStart?.(internalName)}>내부 이름으로 받기</a>
        )}
      </div>
      <details className="create-file-details">
        <summary aria-label={`${file.title} 파일명과 상세 정보`}>파일명과 상세 정보</summary>
        <div>
          <p>원본 파일명 <bdi>{file.originalFilename}</bdi></p>
          {details}
        </div>
      </details>
    </div>
  );
}
