export default function CollectionCard({ card }: { card: any }) {
  return (
    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 bg-white/5">
      <img 
        src={card.image_url} 
        alt={card.players?.name || 'Carte'} 
        className="object-cover w-full h-full" 
      />
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[10px] font-bold truncate uppercase tracking-wider text-white">
          {card.players?.name}
        </p>
      </div>
    </div>
  );
}