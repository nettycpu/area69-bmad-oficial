import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#C0001A] flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "200px",
        }}
      />
      <div className="relative z-10 text-center flex flex-col items-center gap-6">
        <Link href="/">
          <img
            src="/logo.png"
            alt="AREA 69"
            className="h-16 w-16 object-contain invert mb-2 cursor-pointer"
          />
        </Link>
        <div>
          <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
            AREA 69 · AI Models Studio
          </p>
          <h1 className="text-white text-[120px] font-black leading-none tracking-tighter">
            404
          </h1>
          <p className="text-white/60 text-sm font-bold uppercase tracking-widest mt-2">
            Página não encontrada
          </p>
        </div>
        <Link href="/">
          <button className="mt-2 bg-white text-[#C0001A] px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-colors">
            Voltar ao início
          </button>
        </Link>
      </div>
    </div>
  );
}
