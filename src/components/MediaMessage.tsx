import { useState } from "react";
import { Play, Pause, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaMessageProps {
  type: "image" | "voice";
  mediaUrl: string;
}

const MediaMessage = ({ type, mediaUrl }: MediaMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayPause = () => {
    if (!audio) {
      const newAudio = new Audio(mediaUrl);
      newAudio.onended = () => setIsPlaying(false);
      setAudio(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } else if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  if (type === "image") {
    return (
      <div className="rounded-lg overflow-hidden max-w-xs">
        <img
          src={mediaUrl}
          alt="Shared image"
          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(mediaUrl, "_blank")}
        />
      </div>
    );
  }

  if (type === "voice") {
    return (
      <div className="flex items-center gap-3 bg-muted/50 rounded-full px-4 py-2 min-w-[160px]">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </Button>
        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary w-0 transition-all duration-300" />
        </div>
        <a href={mediaUrl} download className="text-muted-foreground hover:text-foreground">
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return null;
};

export default MediaMessage;
