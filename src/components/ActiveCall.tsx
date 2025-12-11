import { useState, useEffect, useRef } from "react";
import { PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActiveCallProps {
  participantName: string | null;
  participantAvatar: string | null;
  onEndCall: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const ActiveCall = ({
  participantName,
  participantAvatar,
  onEndCall,
  audioRef,
}: ActiveCallProps) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Mute the local audio track
    const audioElement = audioRef.current;
    if (audioElement?.srcObject) {
      const stream = audioElement.srcObject as MediaStream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <audio ref={audioRef} autoPlay className="hidden" />
      
      <div className="flex flex-col items-center space-y-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
          <Avatar className="w-32 h-32 border-4 border-green-500">
            <AvatarImage src={participantAvatar || undefined} />
            <AvatarFallback className="text-3xl bg-gradient-primary text-primary-foreground">
              {participantName?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            {participantName || "Unknown"}
          </h2>
          <p className="text-lg text-green-500 font-mono">{formatDuration(duration)}</p>
        </div>

        <div className="flex gap-6">
          <Button
            variant="outline"
            size="lg"
            className={`rounded-full w-16 h-16 ${isMuted ? "bg-red-500/20 border-red-500" : ""}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-red-500" /> : <Mic className="w-6 h-6" />}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-16 h-16"
            onClick={onEndCall}
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCall;
