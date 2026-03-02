import CollectionCard from '@/components/CollectionCard';

export default function CollectionPage() {
  const filters = ['TOUT', 'AUTO', 'PATCH', 'ROOKIE', 'NUMÉROTÉE'];

  return (
    <div className="px-4 pt-12">
      <h1 className="text-5xl font-black italic tracking-tighter mb-6 uppercase">
        COLLECTION
      </h1>

      {/* Filtres horizontaux scrollables */}
      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {filters.map((filter) => (
          <button 
            key={filter}
            className="whitespace-nowrap px-4 py-2 rounded-full border border-white/20 text-xs font-bold hover:bg-app-neon hover:text-black transition-colors"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Grille de cartes (2 colonnes sur mobile) */}
      <div className="grid grid-cols-2 gap-4">
        {/* On bouclera ici sur tes données Supabase plus tard */}
        <div className="animate-pulse bg-white/5 aspect-[2/3] rounded-xl" />
        <div className="animate-pulse bg-white/5 aspect-[2/3] rounded-xl" />
        <div className="animate-pulse bg-white/5 aspect-[2/3] rounded-xl" />
        <div className="animate-pulse bg-white/5 aspect-[2/3] rounded-xl" />
      </div>
    </div>
  );
}