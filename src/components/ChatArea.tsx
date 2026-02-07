import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2, SmilePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import VoiceRecorder from "./VoiceRecorder";
import ImageUpload from "./ImageUpload";
import CallButton from "./CallButton";
import GifPicker from "./GifPicker";
import { useNotifications } from "@/hooks/useNotifications";

interface Message {
  id: string;
  content: string;
  user_id: string;
  is_copilot: boolean;
  created_at: string;
  message_type?: string;
  media_url?: string | null;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ChatAreaProps {
  user: User;
  conversationId: string | null;
  onCall?: (conversationId: string, receiverId: string) => void;
  isCalling?: boolean;
}

interface TypingUser {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface Participant {
  user_id: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const ChatArea = ({ user, conversationId, onCall, isCalling }: ChatAreaProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const { toast } = useToast();
  const { notifyMessage } = useNotifications();
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      loadParticipants();
      const unsubMessages = subscribeToMessages();
      const unsubPresence = subscribeToPresence();
      
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        broadcastTyping(false);
        unsubMessages();
        unsubPresence();
      };
    }
  }, [conversationId]);

  const loadParticipants = async () => {
    if (!conversationId) return;
    
    const { data } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);
    
    if (data) {
      const userIds = data.map((p) => p.user_id).filter((id) => id !== user.id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      
      setParticipants(
        userIds.map((userId) => ({
          user_id: userId,
          profiles: profiles?.find((p) => p.id === userId),
        }))
      );
    }
  };

  const handleCall = () => {
    if (conversationId && participants.length > 0 && onCall) {
      onCall(conversationId, participants[0].user_id);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

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
          const newMsg = payload.new as Message;
          
          // Fetch profile data for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", newMsg.user_id)
            .maybeSingle();
          
          // Send notification if message is from someone else
          if (newMsg.user_id !== user.id) {
            const senderName = profile?.display_name || "Someone";
            const preview = newMsg.message_type === "text" 
              ? newMsg.content.substring(0, 50) 
              : newMsg.message_type === "image" ? "📷 Image" : "🎤 Voice message";
            notifyMessage(senderName, preview);
          }
          
          setMessages((prev) => [
            ...prev,
            { ...newMsg, profiles: profile || undefined }
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToPresence = () => {
    // Get current user profile
    const loadUserProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    };

    const channel = supabase.channel(`presence-${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing: TypingUser[] = [];

        Object.keys(state).forEach((presenceKey) => {
          const presences = state[presenceKey];
          presences.forEach((presence: any) => {
            if (presence.user_id !== user.id && presence.typing) {
              typing.push({
                user_id: presence.user_id,
                display_name: presence.display_name,
                avatar_url: presence.avatar_url,
              });
            }
          });
        });

        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const profile = await loadUserProfile();
          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name,
            avatar_url: profile?.avatar_url,
            typing: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const broadcastTyping = async (isTyping: boolean) => {
    if (!conversationId) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const channel = supabase.channel(`presence-${conversationId}`);
    await channel.track({
      user_id: user.id,
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
      typing: isTyping,
    });
  };

  const handleTyping = () => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Broadcast typing
    broadcastTyping(true);

    // Set timeout to stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 2000);
  };

  const sendMessage = async (content: string, isCopilot = false, messageType = "text", mediaUrl?: string) => {
    if (!conversationId || (!content.trim() && messageType === "text" && !mediaUrl)) return;

    setLoading(true);
    try {
      const displayContent = content.trim() || 
        (messageType === "image" ? "📷 Image" : 
         messageType === "gif" ? "GIF" : "🎤 Voice message");
      
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        content: displayContent,
        is_copilot: isCopilot,
        message_type: messageType === "gif" ? "image" : messageType,
        media_url: mediaUrl,
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

  const uploadMedia = async (file: Blob, type: "image" | "voice"): Promise<string | null> => {
    const ext = type === "image" ? "jpg" : "webm";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("chat-media")
      .upload(fileName, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleImageSelect = async (file: File) => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const mediaUrl = await uploadMedia(file, "image");
      if (mediaUrl) {
        await sendMessage("", false, "image", mediaUrl);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error uploading image",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const mediaUrl = await uploadMedia(audioBlob, "voice");
      if (mediaUrl) {
        await sendMessage("", false, "voice", mediaUrl);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error uploading voice message",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    broadcastTyping(false); // Stop typing indicator when sending
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
      {/* Header with call button */}
      {participants.length > 0 && (
        <div className="border-b border-border p-3 bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {participants[0].profiles?.display_name || "Chat"}
            </span>
          </div>
          <CallButton 
            onClick={handleCall} 
            disabled={!onCall || participants.length === 0}
            isCalling={isCalling}
          />
        </div>
      )}
      
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.user_id === user.id}
              currentUserId={user.id}
            />
          ))}
          {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 bg-card">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex items-center gap-1 relative">
              <ImageUpload onImageSelect={handleImageSelect} disabled={loading} />
              <VoiceRecorder onRecordingComplete={handleVoiceRecording} disabled={loading} />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setShowGifPicker((p) => !p)}
                disabled={loading}
              >
                <SmilePlus className="w-5 h-5" />
              </Button>
              {showGifPicker && (
                <GifPicker
                  onSelect={(gifUrl) => {
                    sendMessage("GIF", false, "gif", gifUrl);
                    setShowGifPicker(false);
                  }}
                  onClose={() => setShowGifPicker(false)}
                />
              )}
            </div>
            <div className="flex-1 relative">
              <Textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
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