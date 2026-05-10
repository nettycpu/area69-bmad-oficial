import React from "react";
import { motion } from "framer-motion";

export default function GallerySection() {
  return (
    <section className="py-24 bg-white overflow-hidden border-t-8 border-[#C0001A]">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 mb-16">
        <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter mb-4 text-black">
          Resultados Editoriais
        </h2>
        <p className="text-black/60 font-medium max-w-xl">
          Gerado 100% por AI usando modelos treinados na AREA 69. Apenas prompts de texto, sem câmera real.
        </p>
      </div>

      <div className="flex w-[200vw] md:w-[150vw] gap-4 px-6 relative left-1/2 -translate-x-1/2">
        {[
          "/images/polaroid-1.png",
          "/images/gallery-1.png",
          "/images/gallery-2.png",
          "/images/gallery-3.png",
          "/images/gallery-4.png",
          "/images/gallery-5.png",
          "/images/polaroid-1.png",
          "/images/gallery-1.png",
        ].map((src, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="w-[300px] md:w-[450px] aspect-[4/5] bg-red-50 flex-shrink-0 relative group border-4 border-white shadow-lg overflow-hidden"
          >
            <img
              src={src}
              alt={`Gallery ${i}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#C0001A]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 z-20">
              <span className="text-white text-xs font-bold uppercase tracking-widest border border-white/50 px-3 py-1">
                AI GENERATED
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
