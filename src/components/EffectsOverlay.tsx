import { useState, useEffect, useCallback } from "react";
import { subscribeEffectsChannel, unsubscribeEffectsChannel } from "@/lib/effectsChannel";

const EffectsOverlay = () => {
  const [discoActive, setDiscoActive] = useState(false);
  const [funnyActive, setFunnyActive] = useState(false);
  const [broadcastText, setBroadcastText] = useState<string | null>(null);
  const [emojis, setEmojis] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);

  const triggerDisco = useCallback(() => {
    setDiscoActive(true);
    setTimeout(() => setDiscoActive(false), 30000);
  }, []);

  const triggerFunny = useCallback(() => {
    setFunnyActive(true);
    const laughEmojis = ["😂", "🤣", "😆", "💀", "😹", "🫠"];
    let count = 0;
    const interval = setInterval(() => {
      const batch = Array.from({ length: 5 }, (_, i) => ({
        id: Date.now() + i + count,
        x: Math.random() * 100,
        y: Math.random() * 100,
        emoji: laughEmojis[Math.floor(Math.random() * laughEmojis.length)],
      }));
      setEmojis((prev) => [...prev, ...batch].slice(-60));
      count += 5;
    }, 400);
    setTimeout(() => {
      clearInterval(interval);
      setFunnyActive(false);
      setEmojis([]);
    }, 10000);
  }, []);

  const triggerText = useCallback((text: string) => {
    setBroadcastText(text);
    setTimeout(() => setBroadcastText(null), 5000);
  }, []);

  useEffect(() => {
    const channel = subscribeEffectsChannel();

    channel
      .on("broadcast", { event: "effect" }, ({ payload }) => {
        console.log("[Effects] Received effect:", payload.effect);
        switch (payload.effect) {
          case "disco":
            triggerDisco();
            break;
          case "funny":
            triggerFunny();
            break;
          case "text":
            if (payload.text) triggerText(payload.text as string);
            break;
        }
      })
      .subscribe((status) => {
        console.log("[Effects] Channel status:", status);
      });

    return () => {
      unsubscribeEffectsChannel();
    };
  }, [triggerDisco, triggerFunny, triggerText]);

  return (
    <>
      {discoActive && (
        <div className="fixed inset-0 z-[9990] pointer-events-none animate-fade-in">
          <div
            className="absolute inset-0 mix-blend-multiply opacity-30"
            style={{
              background: "linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet, red)",
              backgroundSize: "400% 400%",
              animation: "discoShift 1s ease infinite",
            }}
          />
        </div>
      )}

      {funnyActive && (
        <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden">
          {emojis.map((e) => (
            <span
              key={e.id}
              className="absolute text-3xl animate-bounce"
              style={{ left: `${e.x}%`, top: `${e.y}%`, animationDuration: `${0.5 + Math.random()}s` }}
            >
              {e.emoji}
            </span>
          ))}
        </div>
      )}

      {broadcastText && (
        <div className="fixed top-0 left-0 right-0 z-[9991] flex justify-center pointer-events-none animate-fade-in">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-b-xl shadow-xl text-lg font-bold max-w-2xl text-center">
            Adrian: {broadcastText}
          </div>
        </div>
      )}

      {discoActive && (
        <style>{`
          @keyframes discoShift {
            0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
            50% { background-position: 100% 50%; filter: hue-rotate(180deg); }
            100% { background-position: 0% 50%; filter: hue-rotate(360deg); }
          }
        `}</style>
      )}
    </>
  );
};

export default EffectsOverlay;
