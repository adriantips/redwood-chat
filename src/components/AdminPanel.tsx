import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Disc3,
  Laugh,
  MessageSquareText,
  X,
  Minus,
  GripHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CHANNEL_NAME = "admin-effects";

const AdminPanel = ({ onClose }: { onClose: () => void }) => {
  const [minimized, setMinimized] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [position, setPosition] = useState({ x: 60, y: 60 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const { toast } = useToast();

  const sendEffect = useCallback(
    (effect: string, payload?: Record<string, unknown>) => {
      const channel = supabase.channel(CHANNEL_NAME);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "effect",
            payload: { effect, ...payload },
          });
          toast({ title: `🎉 ${effect} activated!` });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });
    },
    [toast]
  );

  const handleDisco = () => sendEffect("disco");
  const handleFunny = () => sendEffect("funny");
  const handleBroadcast = () => {
    if (!broadcastText.trim()) return;
    sendEffect("text", { text: broadcastText.trim() });
    setBroadcastText("");
  };

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
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
    <div
      className="fixed z-[9999] select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="bg-card border-2 border-primary rounded-xl shadow-xl overflow-hidden min-w-[280px] animate-scale-in">
        {/* Title bar */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <GripHorizontal className="w-4 h-4" />
            🔥 Admin Abuse
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="hover:bg-primary-foreground/20 rounded p-0.5"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="hover:bg-primary-foreground/20 rounded p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="p-3 space-y-3">
            <Button
              onClick={handleDisco}
              className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 hover:opacity-90 text-white font-bold"
              size="sm"
            >
              <Disc3 className="w-4 h-4 mr-2 animate-spin" />
              Rainbow Disco (30s)
            </Button>

            <Button
              onClick={handleFunny}
              variant="outline"
              className="w-full font-bold"
              size="sm"
            >
              <Laugh className="w-4 h-4 mr-2" />
              Funny Mode (10s)
            </Button>

            <div className="flex gap-2">
              <Input
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Broadcast message..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleBroadcast();
                }}
              />
              <Button onClick={handleBroadcast} size="sm" variant="secondary">
                <MessageSquareText className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
