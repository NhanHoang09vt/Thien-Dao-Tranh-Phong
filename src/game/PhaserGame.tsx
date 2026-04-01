import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Phaser from "phaser";
import CombatScene from "./scenes/CombatScene";
import { Character, Equipment } from "../types";

interface PhaserGameProps {
  character: Character;
  onCombatEnd?: (result: any) => void;
}

export interface PhaserGameRef {
  equipItem: (target: "player" | "enemy", item: Equipment | null, slot?: string) => void;
}

const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>(({ character, onCombatEnd }, ref) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useImperativeHandle(ref, () => ({
    equipItem: (target: "player" | "enemy", item: Equipment | null, slot?: string) => {
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene("CombatScene") as CombatScene;
        if (scene) {
          scene.equipItem(target, item, slot);
        }
      }
    }
  }));

  useEffect(() => {
    if (!gameContainerRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameContainerRef.current,
      backgroundColor: "#000000",
      scene: [CombatScene],
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Start the combat scene with character data
    game.scene.start("CombatScene", { character });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []); // Only run once on mount

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/50 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
      <div ref={gameContainerRef} className="w-[800px] h-[600px] max-w-full max-h-full" />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 p-4 glass-card rounded-2xl pointer-events-none">
        <h3 className="text-orange-500 font-black uppercase tracking-widest text-xs mb-2">Thông Tin Giao Tranh</h3>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Huyền (Player)</span>
            <span className="text-sm font-mono font-bold text-white">{character.name}</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Huyễn (Phantom)</span>
            <span className="text-sm font-mono font-bold text-red-500">Bóng Ma Vực Thẳm</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PhaserGame;
