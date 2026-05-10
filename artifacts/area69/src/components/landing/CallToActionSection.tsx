import React from "react";
import { Link } from "wouter";

export default function CallToActionSection() {
  return (
    <section className="py-32 bg-[#C0001A] text-white relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full overflow-hidden opacity-10 pointer-events-none whitespace-nowrap">
        <h2 className="text-[20vw] font-bold uppercase tracking-tighter leading-none text-center text-white">
          CREATE NOW
        </h2>
      </div>

      <div className="max-w-[800px] mx-auto px-6 text-center relative z-10">
        <h2 className="text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-8 text-white">
          Seu estúdio virtual <br /> está pronto.
        </h2>
        <p className="text-xl md:text-2xl font-medium mb-12 text-white/80">
          Pare de depender de fotógrafos para criar conteúdo de altíssimo nível. Treine seu modelo hoje e comece a gerar.
        </p>

        <Link href="/sign-up" className="inline-block bg-white text-[#C0001A] px-12 py-6 font-bold uppercase tracking-widest text-lg hover:bg-red-50 transition-all shadow-2xl hover:scale-105 transform">
          Criar Modelo Agora
        </Link>
      </div>
    </section>
  );
}
