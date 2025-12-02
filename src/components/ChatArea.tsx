import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import MessageBubble from "./MessageBubble";

interface Message {
  id: string;
  content: string;
  user_id: string;
  is_copilot: boolean;
  created_at: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ChatAreaProps {
  user: User;
  conversationId: string | null;
}

const ChatArea = ({ user, conversationId }: ChatAreaProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      subscribeToMessages();
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data: messagesData, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading messages",
        description: error.message,
      });
      return;
    }

    if (!messagesData) {
      setMessages([]);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(messagesData.map((m) => m.user_id))];

    // Fetch profiles for all users
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    // Create a map of user_id to profile
    const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

    // Merge profiles with messages
    const messagesWithProfiles = messagesData.map((msg) => ({
      ...msg,
      profiles: profilesMap.get(msg.user_id),
    }));

    setMessages(messagesWithProfiles);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Fetch profile data for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", newMessage.user_id)
            .maybeSingle();
          
          setMessages((prev) => [
            ...prev,
            { ...newMessage, profiles: profile || undefined }
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (content: string, isCopilot = false) => {
    if (!conversationId || !content.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        content: content.trim(),
        is_copilot: isCopilot,
      });

      if (error) throw error;

      if (!isCopilot) {
        setNewMessage("");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const handleCopilotAssist = async () => {
    if (!newMessage.trim()) {
      toast({
        title: "Enter a message",
        description: "Type something for the copilot to help with.",
      });
      return;
    }

    setCopilotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-assist", {
        body: { message: newMessage },
      });

      if (error) throw error;

      // Send the AI's response as a copilot message
      await sendMessage(data.response, true);
      
      toast({
        title: "Copilot response added",
        description: "AI has provided suggestions to your conversation.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Copilot error",
        description: error.message,
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-primary mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Welcome to ChatFlow</h2>
          <p className="text-muted-foreground">
            Select a conversation or start a new one to begin chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.user_id === user.id}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 bg-card">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[60px] resize-none pr-12 border-2 focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 bottom-2 text-copilot hover:bg-copilot/10"
                onClick={handleCopilotAssist}
                disabled={copilotLoading}
              >
                {copilotLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Button type="submit" size="icon" disabled={loading || !newMessage.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;