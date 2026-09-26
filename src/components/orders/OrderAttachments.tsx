"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

type Attachment = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  signed_url: string | null;
};

export default function OrderAttachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter((attachment) => attachment.mime_type.startsWith("image/"));
  const otherFiles = attachments.filter((attachment) => !attachment.mime_type.startsWith("image/"));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const move = (direction: number) => {
    setActiveIndex((index) =>
      index === null ? null : (index + direction + images.length) % images.length,
    );
  };

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") {
        setActiveIndex((index) =>
          index === null ? null : (index - 1 + images.length) % images.length,
        );
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((index) =>
          index === null ? null : (index + 1) % images.length,
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, images.length]);

  return (
    <>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((attachment, index) => (
            <div key={attachment.id} className="min-w-0">
              {attachment.signed_url && !failedImages.includes(attachment.id) ? (
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Agrandir ${attachment.original_filename}`}
                  className="group border-base-300 bg-base-200 focus-visible:outline-primary block aspect-square w-full overflow-hidden rounded-lg border text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {/* Signed private storage URLs are not configured as Next image origins. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.signed_url}
                    alt={attachment.original_filename}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((current) => [...current, attachment.id])}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ) : (
                <div className="border-base-300 bg-base-200 text-base-content/55 flex aspect-square items-center justify-center rounded-lg border p-3 text-center text-xs">
                  Aperçu indisponible
                </div>
              )}
              <p className="mt-2 truncate text-sm font-medium" title={attachment.original_filename}>
                {attachment.original_filename}
              </p>
              <p className="text-base-content/55 text-xs">{formatFileSize(attachment.size_bytes)}</p>
              {attachment.signed_url ? (
                <a
                  href={attachment.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary mt-1 inline-block text-xs font-medium hover:underline"
                >
                  Ouvrir l&apos;original
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {otherFiles.length > 0 ? (
        <ul
          className={`divide-base-300 divide-y ${images.length > 0 ? "border-base-300 border-t" : ""}`}
        >
          {otherFiles.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-4 px-6 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {attachment.original_filename}
                </span>
                <span className="text-base-content/55 block text-xs">
                  {formatFileSize(attachment.size_bytes)} · {attachment.mime_type}
                </span>
              </span>
              {attachment.signed_url ? (
                <a href={attachment.signed_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  Ouvrir
                </a>
              ) : (
                <span className="badge badge-warning badge-sm">Lien indisponible</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {activeImage?.signed_url ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Aperçu de ${activeImage.original_filename}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white sm:p-6"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="flex items-center justify-between gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="min-w-0 truncate text-sm">
              {activeImage.original_filename} · {activeIndex === null ? 0 : activeIndex + 1}/{images.length}
            </span>
            <div className="flex shrink-0 gap-2">
              <a
                href={activeImage.signed_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
              >
                Ouvrir l&apos;original
              </a>
              <button
                ref={closeButton}
                type="button"
                aria-label="Fermer l'aperçu"
                onClick={() => setActiveIndex(null)}
                className="rounded-lg border border-white/30 p-2 hover:bg-white/10"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            {images.length > 1 ? (
              <button
                type="button"
                aria-label="Image précédente"
                onClick={() => move(-1)}
                className="rounded-lg border border-white/30 p-2 hover:bg-white/10"
              >
                <Icon name="arrowRight" className="h-5 w-5 rotate-180" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.signed_url}
              alt={activeImage.original_filename}
              referrerPolicy="no-referrer"
              className="max-h-full min-w-0 max-w-full flex-1 object-contain"
            />
            {images.length > 1 ? (
              <button
                type="button"
                aria-label="Image suivante"
                onClick={() => move(1)}
                className="rounded-lg border border-white/30 p-2 hover:bg-white/10"
              >
                <Icon name="arrowRight" className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}
