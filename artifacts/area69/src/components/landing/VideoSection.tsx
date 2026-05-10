import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const videos = [
  { src: "/videos/demo.mp4", delay: 0.2 },
  { src: "/videos/demo2.mp4", delay: 0.35 },
  { src: "/videos/demo3.mp4", delay: 0.5 },
  { src: "/videos/demo4.mp4", delay: 0.65 },
];

function AutoPlayVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      className="absolute inset-0 w-full h-full object-cover"
      loop
      muted
      playsInline
      preload="auto"
    />
  );
}

export default function VideoSection() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-[1000px] mx-auto px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <span className="bg-[#C0001A] text-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full mb-6 inline-block">
            Vídeo
          </span>
          <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-black leading-none">
            Demonstração em <br />
            <span className="text-[#C0001A]">Vídeos? Temos.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 md:gap-8">
          {videos.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: v.delay }}
              className="relative border-4 border-[#C0001A] shadow-2xl overflow-hidden bg-black"
              style={{ aspectRatio: "9/16" }}
            >
              <AutoPlayVideo src={v.src} />
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-black/40 text-xs font-bold uppercase tracking-widest mt-8"
        >
          Gerado 100% por AI · Sem câmera · Sem estúdio
        </motion.p>
      </div>
    </section>
  );
}
