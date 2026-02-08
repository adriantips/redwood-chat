import { useState, useEffect, useCallback } from "react";
import { subscribeEffectsChannel, unsubscribeEffectsChannel } from "@/lib/effectsChannel";

const EffectsOverlay = () => {
  const [discoActive, setDiscoActive] = useState(false);
  const [funnyActive, setFunnyActive] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const [broadcastText, setBroadcastText] = useState<string | null>(null);
  const [broadcastGif, setBroadcastGif] = useState<string | null>(null);
  const [kaiCenatActive, setKaiCenatActive] = useState(false);
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

  const triggerShake = useCallback(() => {
    setShakeActive(true);
    setTimeout(() => setShakeActive(false), 3000);
  }, []);

  const triggerText = useCallback((text: string) => {
    setBroadcastText(text);
    setTimeout(() => setBroadcastText(null), 5000);
  }, []);

  const triggerGif = useCallback((url: string) => {
    setBroadcastGif(url);
    setTimeout(() => setBroadcastGif(null), 8000);
  }, []);

  const triggerKaiCenat = useCallback(() => {
    setKaiCenatActive(true);
    setTimeout(() => setKaiCenatActive(false), 5000);
  }, []);

  const triggerSound = useCallback((url: string) => {
    try {
      const audio = new Audio(url);
      audio.volume = 1;
      audio.play().catch((err) => console.warn("[Effects] Audio play blocked:", err));
    } catch (err) {
      console.warn("[Effects] Audio error:", err);
    }
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
          case "shake":
            triggerShake();
            break;
          case "gif":
            if (payload.url) triggerGif(payload.url as string);
            break;
          case "kai-cenat":
            triggerKaiCenat();
            break;
          case "sound":
            if (payload.url) triggerSound(payload.url as string);
            break;
        }
      })
      .subscribe((status) => {
        console.log("[Effects] Channel status:", status);
      });

    return () => {
      unsubscribeEffectsChannel();
    };
  }, [triggerDisco, triggerFunny, triggerText, triggerShake, triggerGif, triggerKaiCenat, triggerSound]);

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

      {broadcastGif && (
        <div className="fixed inset-0 z-[9992] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="bg-card/90 backdrop-blur-sm p-3 rounded-2xl shadow-2xl border-2 border-primary max-w-md">
            <p className="text-xs font-bold text-center mb-2 text-primary">🔥 Admin GIF</p>
            <img src={broadcastGif} alt="Broadcast GIF" className="rounded-lg max-h-[300px] w-auto mx-auto" />
          </div>
        </div>
      )}

      {kaiCenatActive && (
        <div className="fixed inset-0 z-[9993] flex items-start justify-center pointer-events-none animate-fade-in pt-4">
          <img
            src="/images/kai-cenat-troll.gif"
            alt="Kai Cenat Troll"
            className="rounded-2xl shadow-2xl border-4 border-yellow-400"
            style={{ maxHeight: "70vh", maxWidth: "90vw", width: "auto" }}
          />
        </div>
      )}

      {shakeActive && (
        <div className="fixed inset-0 z-[9989] pointer-events-none" style={{ animation: "screenShake 0.15s ease-in-out infinite" }} />
      )}

      <style>{`
        @keyframes discoShift {
          0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
          50% { background-position: 100% 50%; filter: hue-rotate(180deg); }
          100% { background-position: 0% 50%; filter: hue-rotate(360deg); }
        }
        @keyframes screenShake {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-8px, -6px); }
          20% { transform: translate(8px, 4px); }
          30% { transform: translate(-6px, 8px); }
          40% { transform: translate(6px, -4px); }
          50% { transform: translate(-4px, 6px); }
          60% { transform: translate(4px, -8px); }
          70% { transform: translate(-8px, 4px); }
          80% { transform: translate(8px, -6px); }
          90% { transform: translate(-4px, -4px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>

      {shakeActive && (
        <style>{`
          body { animation: screenShake 0.15s ease-in-out infinite; }
        `}</style>
      )}
    </>
  );
};

export default EffectsOverlay;
