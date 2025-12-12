import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  userId: string;
  isOwn: boolean;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

const MessageReactions = ({ messageId, userId, isOwn }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReactions();
    const unsubscribe = subscribeToReactions();
    return () => {
      unsubscribe();
    };
  }, [messageId]);

  const loadReactions = async () => {
    const { data, error } = await supabase
      .from("message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId);

    if (error) {
      console.error("Error loading reactions:", error);
      return;
    }

    const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
    
    data?.forEach((r) => {
      const existing = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
      reactionMap.set(r.emoji, {
        count: existing.count + 1,
        userReacted: existing.userReacted || r.user_id === userId,
      });
    });

    setReactions(
      Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        ...data,
      }))
    );
  };

  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleReaction = async (emoji: string) => {
    if (loading) return;
    setLoading(true);

    try {
      const existingReaction = reactions.find((r) => r.emoji === emoji && r.userReacted);

      if (existingReaction) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId)
          .eq("emoji", emoji);
      } else {
        await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: userId,
            emoji,
          });
      }
      
      setIsOpen(false);
    } catch (error) {
      console.error("Error toggling reaction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
      {reactions.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => toggleReaction(reaction.emoji)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
                reaction.userReacted
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SmilePlus className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="text-xl p-1 hover:bg-muted rounded transition-colors"
                disabled={loading}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
