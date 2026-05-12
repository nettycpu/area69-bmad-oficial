import React, { useState, useRef, useEffect } from "react";

interface VideoPreviewProps {
  src: string;
  poster?: string | null;
  aspectRatio?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  showDownload?: boolean;
  showOpen?: boolean;
}

function aspectClass(ratio: string): string {
  const map: Record<string, string> = {
    "21:9": "aspect-[21/9]", "16:9": "aspect-video", "4:3": "aspect-[4/3]",
    "1:1": "aspect-square",  "3:4": "aspect-[3/4]",  "9:16": "aspect-[9/16]",
  };
  return map[ratio] ?? "aspect-video";
}

export default function VideoPreview({
  src,
  poster,
  aspectRatio = "16:9",
  controls: showControls = true,
  autoPlay = false,
  muted = true,
  loop = false,
  className = "",
  showDownload = false,
  showOpen = false,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  function handleMouseEnter() {
    setHovering(true);
    if (videoRef.current && !error) {
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  if (error) {
    return (
      <div className={`${aspectClass(aspectRatio)} w-full bg-black/10 flex flex-col items-center justify-center gap-2 ${className}`}>
        <span className="text-2xl opacity-30">▷</span>
        <p className="text-[9px] text-black/40 font-medium px-4 text-center">
          Não foi possível carregar preview
        </p>
        {showOpen && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-[9px] font-black uppercase tracking-widest text-[#7C3AED] hover:underline"
          >
            Abrir vídeo
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full bg-black overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!loaded && !error && (
        <div className={`${aspectClass(aspectRatio)} w-full bg-black/5 animate-pulse flex items-center justify-center`}>
          {poster ? (
            <img src={poster} alt="" className="w-full h-full object-cover opacity-50" />
          ) : (
            <span className="text-2xl opacity-20">▷</span>
          )}
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        preload="metadata"
        playsInline
        muted={muted}
        loop={loop}
        controls={showControls && loaded}
        autoPlay={autoPlay}
        onLoadedMetadata={() => setLoaded(true)}
        onCanPlay={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-contain ${loaded ? "" : "hidden"}`}
      />
      {hovering && !loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-3xl opacity-70">▷</span>
        </div>
      )}
      {showDownload && loaded && (
        <div className="absolute bottom-2 right-2 flex gap-1.5 pointer-events-auto">
          {showOpen && (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 hover:bg-black/80 transition-colors"
            >
              Abrir
            </a>
          )}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            download
            className="bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 hover:bg-black/80 transition-colors"
          >
            ↓
          </a>
        </div>
      )}
    </div>
  );
}
