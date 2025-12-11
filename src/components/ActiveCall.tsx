import { useState, useEffect } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActiveCallProps {
  participantName: string | null;
  participantAvatar: string | null;
  onEndCall: () => void;
  onToggleVideo: () => boolean;
  onToggleAudio: () => boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

const ActiveCall = ({
  participantName,
  participantAvatar,
  onEndCall,
  onToggleVideo,
  onToggleAudio,
  localVideoRef,
  remoteVideoRef,
}: ActiveCallProps) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

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

  const handleToggleMute = () => {
    const newState = onToggleAudio();
    setIsMuted(!newState);
  };

  const handleToggleVideo = () => {
    const newState = onToggleVideo();
    setIsVideoOff(!newState);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Fallback avatar when no video */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-4">
            <Avatar className="w-32 h-32 border-4 border-white/20 mx-auto">
              <AvatarImage src={participantAvatar || undefined} />
              <AvatarFallback className="text-4xl bg-gradient-primary text-primary-foreground">
                {participantName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold text-white">
              {participantName || "Unknown"}
            </h2>
          </div>
        </div>

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-32 h-48 md:w-48 md:h-64 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
          />
          {isVideoOff && (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full">
          <p className="text-white font-mono">{formatDuration(duration)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border-t border-border p-6">
        <div className="flex justify-center gap-6">
          <Button
            variant="outline"
            size="lg"
            className={`rounded-full w-14 h-14 ${isMuted ? "bg-red-500/20 border-red-500" : ""}`}
            onClick={handleToggleMute}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-red-500" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className={`rounded-full w-14 h-14 ${isVideoOff ? "bg-red-500/20 border-red-500" : ""}`}
            onClick={handleToggleVideo}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-red-500" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14"
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
