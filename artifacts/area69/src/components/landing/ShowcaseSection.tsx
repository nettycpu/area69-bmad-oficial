import React from "react";
import { motion } from "framer-motion";

export default function ShowcaseSection() {
  return (
    <section className="py-24 bg-[#C0001A] overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-white leading-none">
            Veja o que<br /><span className="font-cursive lowercase">você pode criar</span>
          </h2>
          <p className="text-white/70 font-medium max-w-xs text-sm uppercase tracking-widest">
            100% gerado por AI — sem câmera, sem estúdio
          </p>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">

          {/* Large card - spans 2 rows */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="col-span-1 row-span-2 md:row-span-2 relative group overflow-hidden bg-white"
            style={{ gridRow: "span 2" }}
          >
            <img
              src="/images/showcase-1.png"
              alt="AI Generated"
              className="w-full h-full object-cover object-top min-h-[500px] md:min-h-[700px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="col-span-1 relative group overflow-hidden bg-white"
          >
            <img
              src="/images/showcase-2.png"
              alt="AI Generated"
              className="w-full h-full object-cover min-h-[240px] md:min-h-[340px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-1 relative group overflow-hidden bg-white"
          >
            <img
              src="/images/showcase-3.png"
              alt="AI Generated"
              className="w-full h-full object-cover min-h-[240px] md:min-h-[340px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>

          {/* Card 4 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="col-span-1 relative group overflow-hidden bg-white"
          >
            <img
              src="/images/showcase-4.png"
              alt="AI Generated"
              className="w-full h-full object-cover min-h-[240px] md:min-h-[340px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>

          {/* Card 5 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="col-span-1 relative group overflow-hidden bg-white"
          >
            <img
              src="/images/gallery-4.png"
              alt="AI Generated"
              className="w-full h-full object-cover min-h-[240px] md:min-h-[340px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>

          {/* Card 6 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="col-span-1 relative group overflow-hidden bg-white"
          >
            <img
              src="/images/gallery-5.png"
              alt="AI Generated"
              className="w-full h-full object-cover min-h-[240px] md:min-h-[340px] group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-[10px] font-bold uppercase tracking-widest border border-white/50 px-3 py-1 bg-black/40">
                Gerado com Area 69
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom CTA strip */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
          Todas as imagens geradas com modelos treinados na AREA 69
        </p>
        <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Gerando agora mesmo
        </div>
      </div>
    </section>
  );
}
