import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[#0F1115]">
      <h1 className="text-6xl font-black italic uppercase tracking-tighter text-white">
        CARD<span className="text-[#DFFF00]">BULK</span>
      </h1>
      <p className="text-gray-400 mt-4 font-medium uppercase text-xs tracking-[0.2em]">
        Scan. Collect. Dominate.
      </p>
      
      <Link href="/collection" className="mt-12 bg-[#DFFF00] text-black font-black italic px-10 py-4 rounded-full uppercase shadow-lg shadow-[#DFFF00]/20 active:scale-95 transition-transform">
        Ouvrir la collection
      </Link>
    </div>
  );
}