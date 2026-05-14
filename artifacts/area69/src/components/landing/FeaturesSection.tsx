import React from "react";
import { motion } from "framer-motion";

export default function FeaturesSection() {
  const features = [
    {
      title: "Modelos Customizados",
      desc: "Treinamento especializado com tecnologia de ponta para manter a consistência absoluta do seu rosto em todas as gerações.",
      icon: "01",
      rotate: "-rotate-2"
    },
    {
      title: "Geração Asíncrona",
      desc: "Trabalhamos em background. Jobs assíncronos e webhooks para entregar as mídias direto no seu sistema.",
      icon: "02",
      rotate: "rotate-1"
    },
    {
      title: "Vídeos Ultra-Realistas",
      desc: "Gere não apenas fotos, mas vídeos cinemáticos de alta qualidade com o seu avatar, com liberdade criativa e sem marca d'agua.",
      icon: "03",
      rotate: "rotate-3"
    },
    {
      title: "Segurança de Dados",
      desc: "Suas fotos originais não são usadas para treinar modelos base. Histórico com expiração automática garantindo privacidade.",
      icon: "04",
      rotate: "-rotate-1"
    }
  ];

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 relative z-10">
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-end border-b-4 border-[#C0001A] pb-8">
          <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-black">
            A infraestrutura <br/> <span className="text-[#C0001A]">criativa definitiva</span>
          </h2>
          <p className="text-sm uppercase tracking-widest text-black/50 max-w-sm text-right mt-6 md:mt-0 font-bold">
            Ferramentas high-end para creators exigentes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className={`bg-[#C0001A] text-white p-8 shadow-xl ${f.rotate} border-4 border-transparent hover:border-white transition-all cursor-pointer`}
            >
              <div className="text-4xl mb-6 font-black text-white/40">{f.icon}</div>
              <h3 className="text-xl font-bold uppercase tracking-tight mb-4">{f.title}</h3>
              <p className="text-white/80 font-medium text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
