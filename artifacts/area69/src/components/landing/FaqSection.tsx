import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FaqSection() {
  const faqs = [
    {
      q: "Quantas fotos eu preciso enviar?",
      a: "Recomendamos entre 15 e 30 fotos para um resultado perfeito. Idealmente, inclua fotos de rosto (close-ups), meio corpo e corpo inteiro, em diferentes iluminações e sem acessórios que cubram o rosto."
    },
    {
      q: "Vocês usam minhas fotos para treinar outros modelos?",
      a: "Não. Suas fotos são usadas exclusivamente para criar o SEU modelo pessoal. Depois de processadas, elas são apagadas dos nossos servidores conforme nossa política de privacidade."
    },
    {
      q: "Quanto tempo demora para gerar as imagens?",
      a: "O treinamento inicial do seu modelo leva cerca de 20 a 30 minutos. Após isso, cada geração de imagem leva menos de 10 segundos, e vídeos cerca de 2 a 3 minutos dependendo da duração."
    },
    {
      q: "Posso cancelar a qualquer momento?",
      a: "Sim, os planos são mensais e você pode cancelar a renovação automática quando quiser direto no painel da sua conta."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[800px] mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter text-black">
            Perguntas Frequentes
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-2 border-black/10 bg-white px-6 data-[state=open]:border-[#C0001A] transition-colors">
              <AccordionTrigger className="text-left font-bold uppercase tracking-tight text-lg hover:no-underline py-6 text-black">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-black/70 font-medium text-base leading-relaxed pb-6">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
