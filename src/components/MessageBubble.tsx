import { Sparkles, User } from "lucide-react";

interface Message {
  id: string;
  content: string;
  user_id: string;
  is_copilot: boolean;
  created_at: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (message.is_copilot) {
    return (
      <div className="flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-copilot flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-copilot-foreground" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-copilot">AI Copilot</span>
            <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
          <div className="bg-card rounded-2xl rounded-tl-md px-4 py-3 border border-copilot/20 shadow-sm">
            <p className="text-sm text-card-foreground whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 items-start ${isOwn ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isOwn ? "bg-message-user" : "bg-muted"
        }`}
      >
        <User className={`w-4 h-4 ${isOwn ? "text-message-user-foreground" : "text-muted-foreground"}`} />
      </div>
      <div className={`flex-1 space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-medium text-foreground">{isOwn ? "You" : "Other"}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm max-w-[80%] ${
            isOwn
              ? "bg-message-user text-message-user-foreground rounded-tr-md"
              : "bg-message-other text-message-other-foreground rounded-tl-md border border-border"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;