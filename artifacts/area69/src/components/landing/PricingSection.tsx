import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function PricingSection() {
  const plans = [
    {
      name: "Pro",
      price: "R$ 197",
      period: "/mês",
      desc: "Para criadores que querem uma rotina mensal consistente.",
      features: [
        "1 modelo de avatar / Soul ID",
        "100 imagens por mês",
        "10 vídeos por mês",
        "Qualidade Alta",
        "Histórico de 7 dias",
        "Suporte via WhatsApp",
        "Créditos mensais não acumulativos"
      ],
      popular: false
    },
    {
      name: "Business",
      price: "R$ 797",
      period: "/mês",
      desc: "Para equipes e operações que precisam de mais volume mensal.",
      features: [
        "3 modelos de avatar / Soul ID",
        "500 imagens por mês",
        "50 vídeos por mês",
        "Qualidade Máxima",
        "Histórico de 30 dias",
        "Prioridade na fila",
        "Suporte via WhatsApp",
        "Créditos mensais não acumulativos"
      ],
      popular: true
    }
  ];

  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div className="mb-16">
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter text-black">
            Planos & Preços
          </h2>
          <p className="text-black/50 font-medium mt-4 max-w-md">
            Invista na sua imagem sem os custos de uma produção física.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className={`p-8 md:p-12 border-4 flex flex-col relative ${plan.popular ? 'bg-[#C0001A] text-white border-[#C0001A]' : 'bg-white text-black border-black'}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-white text-[#C0001A] px-4 py-1 text-[10px] font-bold uppercase tracking-widest translate-x-2 -translate-y-3">
                  Mais Popular
                </div>
              )}
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-5xl font-bold tracking-tighter">{plan.price}</span>
                <span className={`font-medium uppercase tracking-widest text-xs ${plan.popular ? 'text-white/70' : 'text-black/50'}`}>{plan.period}</span>
              </div>
              <p className={`font-medium mb-8 text-sm ${plan.popular ? 'text-white/70' : 'text-black/60'}`}>{plan.desc}</p>

              <ul className="space-y-4 mb-12 flex-1">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm font-medium">
                    <div className={`w-1.5 h-1.5 rounded-full ${plan.popular ? 'bg-white' : 'bg-[#C0001A]'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className={`block w-full text-center py-4 font-bold uppercase tracking-widest text-sm transition-all ${plan.popular ? 'bg-white text-[#C0001A] hover:bg-red-50' : 'bg-[#C0001A] text-white hover:bg-red-700'}`}
              >
                Assinar {plan.name}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
