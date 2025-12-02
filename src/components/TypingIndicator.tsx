import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TypingUser {
  display_name?: string | null;
  avatar_url?: string | null;
}

interface TypingIndicatorProps {
  users: TypingUser[];
}

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
  if (users.length === 0) return null;

  const displayNames = users
    .map((u) => u.display_name || "Someone")
    .slice(0, 3)
    .join(", ");

  const typingText =
    users.length === 1
      ? `${displayNames} is typing...`
      : `${displayNames} are typing...`;

  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user, idx) => (
          <Avatar key={idx} className="w-8 h-8 border-2 border-background">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {(user.display_name?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex-1 space-y-1">
        <span className="text-xs text-muted-foreground">{typingText}</span>
        <div className="bg-message-other text-message-other-foreground rounded-2xl rounded-tl-md px-4 py-3 border border-border shadow-sm inline-flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
