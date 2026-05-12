import React from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useI18n } from "@/lib/I18nContext";

export default function Checkout() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout title={t("checkout.title")} subtitle={t("checkout.subtitle")}>
      <div className="max-w-xl mx-auto text-center py-10">
        <div className="w-16 h-16 bg-black/5 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-black text-black/30">!</span>
        </div>

        <h2 className="text-lg font-black uppercase tracking-tighter text-black mb-3">
          Checkout desativado
        </h2>

        <p className="text-sm text-black/50 font-medium mb-2 leading-relaxed">
          O checkout antigo foi substituído pela nova central de assinaturas.
        </p>

        <p className="text-[10px] text-black/30 font-medium mb-8 max-w-md mx-auto leading-relaxed">
          Compre créditos via Stripe com suporte a cartão de crédito, PIX e muito mais.
          Seu saldo é atualizado automaticamente após a confirmação do pagamento.
        </p>

        <button
          onClick={() => setLocation("/dashboard/billing")}
          className="bg-[#C0001A] text-white px-8 py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors"
        >
          Ir para Billing / Stripe →
        </button>

        <button
          onClick={() => setLocation("/dashboard")}
          className="block mx-auto mt-4 text-[9px] font-black uppercase tracking-widest text-black/30 hover:text-black/60 transition-colors"
        >
          ← Voltar ao Dashboard
        </button>
      </div>
    </DashboardLayout>
  );
}
