import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Disc3,
  Laugh,
  MessageSquareText,
  X,
  Minus,
  GripHorizontal,
  Vibrate,
  Users,
  Zap,
  SmilePlus,
  Volume2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getEffectsChannel, subscribeEffectsChannel, unsubscribeEffectsChannel } from "@/lib/effectsChannel";
import { supabase } from "@/integrations/supabase/client";
import AdminUserManager from "./AdminUserManager";
import GifPicker from "./GifPicker";

type Tab = "effects" | "users";

const AdminPanel = ({ onClose }: { onClose: () => void }) => {
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<Tab>("effects");
  const [broadcastText, setBroadcastText] = useState("");
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [position, setPosition] = useState({ x: 60, y: 60 });
  const [dragging, setDragging] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [uploadingSound, setUploadingSound] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const soundInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const channel = subscribeEffectsChannel();
    const timer = setTimeout(() => setChannelReady(true), 500);
    return () => {
      clearTimeout(timer);
      unsubscribeEffectsChannel();
    };
  }, []);

  const sendEffect = useCallback(
    async (effect: string, payload?: Record<string, unknown>) => {
      const channel = getEffectsChannel();
      const result = await channel.send({
        type: "broadcast",
        event: "effect",
        payload: { effect, ...payload },
      });
      if (result === "ok") {
        toast({ title: `🎉 ${effect} activated!` });
      } else {
        toast({ variant: "destructive", title: `Failed to send (${result})` });
      }
    },
    [toast]
  );

  const handleDisco = () => sendEffect("disco");
  const handleFunny = () => sendEffect("funny");
  const handleShake = () => sendEffect("shake");
  const handleKaiCenat = () => sendEffect("kai-cenat");
  const handleBroadcast = () => {
    if (!broadcastText.trim()) return;
    sendEffect("text", { text: broadcastText.trim() });
    setBroadcastText("");
  };

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSound(true);
    try {
      const fileName = `troll-sounds/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("chat-media").upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
      await sendEffect("sound", { url: urlData.publicUrl });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploadingSound(false);
      if (soundInputRef.current) soundInputRef.current.value = "";
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return (
    <div className="fixed z-[9999] select-none" style={{ left: position.x, top: position.y }}>
      <div className="bg-card border-2 border-primary rounded-xl shadow-xl overflow-hidden min-w-[300px] max-w-[340px] animate-scale-in">
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <GripHorizontal className="w-4 h-4" />
            🔥 Admin Abuse
          </div>
          <div className="flex gap-1">
            <button onClick={() => setMinimized(!minimized)} className="hover:bg-primary-foreground/20 rounded p-0.5">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="hover:bg-primary-foreground/20 rounded p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className="flex border-b">
              <button
                onClick={() => setTab("effects")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                  tab === "effects" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Effects
              </button>
              <button
                onClick={() => setTab("users")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                  tab === "users" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Users
              </button>
            </div>

            <div className="p-3">
              {tab === "effects" && (
                <div className="space-y-3">
                  {!channelReady && (
                    <p className="text-xs text-muted-foreground text-center">Connecting...</p>
                  )}
                  <Button
                    onClick={handleDisco}
                    disabled={!channelReady}
                    className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 hover:opacity-90 text-white font-bold"
                    size="sm"
                  >
                    <Disc3 className="w-4 h-4 mr-2 animate-spin" />
                    Rainbow Disco (30s)
                  </Button>

                  <Button onClick={handleFunny} disabled={!channelReady} variant="outline" className="w-full font-bold" size="sm">
                    <Laugh className="w-4 h-4 mr-2" />
                    Funny Mode (10s)
                  </Button>

                  <Button onClick={handleShake} disabled={!channelReady} variant="outline" className="w-full font-bold" size="sm">
                    <Vibrate className="w-4 h-4 mr-2" />
                    Screen Shake (3s)
                  </Button>

                  <Button onClick={handleKaiCenat} disabled={!channelReady} variant="outline" className="w-full font-bold border-yellow-500 text-yellow-600 hover:bg-yellow-50" size="sm">
                    <Laugh className="w-4 h-4 mr-2" />
                    Kai Cenat Troll (5s)
                  </Button>

                  <div>
                    <input
                      ref={soundInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleSoundUpload}
                    />
                    <Button
                      onClick={() => soundInputRef.current?.click()}
                      disabled={!channelReady || uploadingSound}
                      variant="outline"
                      className="w-full font-bold"
                      size="sm"
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      {uploadingSound ? "Uploading..." : "Sound Troll 🔊"}
                    </Button>
                  </div>

                  <div className="relative">
                    <Button
                      onClick={() => setShowGifPicker((p) => !p)}
                      disabled={!channelReady}
                      variant="outline"
                      className="w-full font-bold"
                      size="sm"
                    >
                      <SmilePlus className="w-4 h-4 mr-2" />
                      Broadcast GIF
                    </Button>
                    {showGifPicker && (
                      <div className="absolute bottom-full mb-1 left-0 z-[10000]">
                        <GifPicker
                          onSelect={(gifUrl) => {
                            sendEffect("gif", { url: gifUrl });
                            setShowGifPicker(false);
                          }}
                          onClose={() => setShowGifPicker(false)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={broadcastText}
                      onChange={(e) => setBroadcastText(e.target.value)}
                      placeholder="Broadcast message..."
                      className="text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleBroadcast(); }}
                    />
                    <Button onClick={handleBroadcast} disabled={!channelReady} size="sm" variant="secondary">
                      <MessageSquareText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {tab === "users" && <AdminUserManager />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;