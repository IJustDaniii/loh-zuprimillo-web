import { FileText, ZoomIn } from "lucide-react";
import { useState } from "react";
import type { MediaView } from "../../shared/contracts";
import { isImageMedia } from "../lib/media";
import { Modal } from "./Modal";

export function MediaBlock({ media }: { media: MediaView[] }) {
  const [selectedImage, setSelectedImage] = useState<MediaView | null>(null);
  if (!media.length) return null;
  return (
    <>
      <div className={`media-grid count-${Math.min(media.length, 4)}`}>
        {media.map((item) => {
          if (isImageMedia(item.kind))
            return (
              <button
                key={item.id}
                type="button"
                className="media-image-trigger protected-media"
                onClick={() => setSelectedImage(item)}
                aria-label={`Ampliar ${item.originalName}`}
              >
                <img
                  src={item.url}
                  alt={item.originalName}
                  loading="lazy"
                  className="protected-media"
                  draggable={false}
                />
                <span className="media-image-zoom" aria-hidden="true">
                  <ZoomIn />
                </span>
              </button>
            );
          if (item.kind === "VIDEO")
            return (
              <video
                key={item.id}
                src={item.url}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                preload="metadata"
                className="protected-media"
                onDragStart={(e) => e.preventDefault()}
              />
            );
          if (item.kind === "AUDIO")
            return (
              <div className="audio-card" key={item.id}>
                <span>ON AIR</span>
                <strong>{item.originalName}</strong>
                <audio
                  src={item.url}
                  controls
                  controlsList="nodownload noplaybackrate"
                  preload="metadata"
                  className="protected-media"
                />
              </div>
            );
          return (
            <a
              key={item.id}
              className="document-card protected-media"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              <FileText />
              <span>
                <strong>{item.originalName}</strong>
                <small>
                  {Math.ceil(item.byteSize / 1024)} KB · vista privada
                </small>
              </span>
            </a>
          );
        })}
      </div>
      {selectedImage && (
        <Modal
          title={selectedImage.originalName}
          onClose={() => setSelectedImage(null)}
        >
          <div className="media-lightbox">
            <img
              src={selectedImage.url}
              alt={selectedImage.originalName}
              className="protected-media"
              draggable={false}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
