{/* Grille d'infos (Brand, Set, etc...) */}
          <div className="grid grid-cols-2 gap-y-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Brand</div>
              <div className="text-lg font-bold text-white capitalize">{card.brand || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Set</div>
              <div className="text-lg font-bold text-white capitalize">{card.series || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Année</div>
              <div className="text-lg font-bold text-white">{card.year || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#AFFF25] font-bold tracking-widest uppercase mb-1">Prix</div>
              <div className="text-lg font-bold text-white">{card.purchase_price ? `${card.purchase_price}€` : "-"}</div>
            </div>
          </div>

          {/* 🚀 NOUVEAU : BOUTON VIEW ON WEBSITE (Si un lien existe) */}
          {card.website_url && (
            <div className="pt-8 flex justify-center pb-6">
              <button 
                onClick={() => window.open(card.website_url, '_blank')}
                className="w-[80%] max-w-[300px] border-2 border-[#AFFF25] text-[#AFFF25] py-3 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#AFFF25]/10 active:scale-95 transition-all shadow-[0_0_15px_rgba(175,255,37,0.2)]"
              >
                View on website
              </button>
            </div>
          )}

        </div>