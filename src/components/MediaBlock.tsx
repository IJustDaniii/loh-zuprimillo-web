import { FileText } from "lucide-react";
import type { MediaView } from "../../shared/contracts";

export function MediaBlock({ media }: { media: MediaView[] }) {
  if (!media.length) return null;
  return (
    <div className={`media-grid count-${Math.min(media.length, 4)}`}>
      {media.map((item) => {
        if (
          item.kind === "IMAGE" ||
          item.kind === "GIF" ||
          item.kind === "AVATAR"
        )
          return (
            <img
              key={item.id}
              src={item.url}
              alt={item.originalName}
              loading="lazy"
              className="protected-media"
              draggable={false}
            />
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
  );
}
