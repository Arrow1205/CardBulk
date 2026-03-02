import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <h1 className="text-6xl font-black italic uppercase tracking-tighter">
        CARD<span className="text-[#DFFF00]">BULK</span>
      </h1>
      <p className="text-gray-400 mt-4 max-w-xs font-medium">
        Gère ta collection de cartes de sport comme un pro.
      </p>
      <Link href="/collection" className="mt-10 bg-[#DFFF00] text-black font-black italic px-8 py-4 rounded-full uppercase shadow-lg shadow-[#DFFF00]/20 active:scale-95 transition-transform">
        Voir ma collection
      </Link>
    </div>
  );
}