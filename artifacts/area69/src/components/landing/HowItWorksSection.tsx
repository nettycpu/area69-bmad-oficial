import React from "react";
import { motion } from "framer-motion";

export default function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Upload",
      desc: "Envie de 15 a 30 fotos suas. Quanto mais natural a luz e variados os ângulos, melhor o resultado final."
    },
    {
      num: "02",
      title: "Treinamento",
      desc: "Nossos modelos processam suas imagens e criam o seu Avatar Digital consistente em 20-30 minutos."
    },
    {
      num: "03",
      title: "Geração",
      desc: "Pronto. Agora é só digitar o conceito (ex: 'ensaio de moda na praia de ibiza, lente 85mm') e receber imagens editoriais incríveis."
    }
  ];

  return (
    <section className="py-24 md:py-32 relative bg-[#C0001A] text-white">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div className="text-center mb-20">
          <span className="bg-white text-[#C0001A] px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full mb-6 inline-block">Workflow</span>
          <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-white">
            Como funciona a <br/> <span className="font-cursive lowercase">mágica</span>
          </h2>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-white/20 -translate-y-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="bg-white text-black p-8 shadow-lg relative group hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="absolute -top-6 -left-6 w-16 h-16 bg-[#C0001A] text-white flex items-center justify-center font-bold text-2xl border-4 border-white rotate-[-10deg] group-hover:rotate-0 transition-all">
                  {step.num}
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-tight mt-4 mb-4 text-black">{step.title}</h3>
                <p className="text-black/70 font-medium leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
