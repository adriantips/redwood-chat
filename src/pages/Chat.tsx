import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ChatSidebar from "@/components/ChatSidebar";
import ChatArea from "@/components/ChatArea";
import UserSelectDialog from "@/components/UserSelectDialog";
import IncomingCallDialog from "@/components/IncomingCallDialog";
import ActiveCall from "@/components/ActiveCall";
import { useToast } from "@/hooks/use-toast";
import { useCalling } from "@/hooks/useCalling";
import { Loader2 } from "lucide-react";

const Chat = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    activeCall,
    incomingCall,
    isCalling,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleVideo,
    toggleAudio,
    localVideoRef,
    remoteVideoRef,
  } = useCalling(user);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        ensureProfile(session.user);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await ensureProfile(session.user);
      } else {
        navigate("/auth");
      }
    } finally {
      setLoading(false);
    }
  };

  const ensureProfile = async (user: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select()
      .eq("id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email!,
      });
    }
  };

  const handleNewConversation = () => {
    setShowUserSelect(true);
  };

  const handleCreateConversation = async (selectedUserIds: string[]) => {
    if (!user) return;

    try {
      const conversationId = crypto.randomUUID();

      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: conversationId, title: "New Conversation" });

      if (convError) throw convError;

      const { error: selfError } = await supabase
        .from("conversation_participants")
        .insert({ conversation_id: conversationId, user_id: user.id });

      if (selfError) throw selfError;

      if (selectedUserIds.length > 0) {
        const { error: othersError } = await supabase.rpc(
          "add_conversation_participants",
          {
            p_conversation_id: conversationId,
            p_user_ids: selectedUserIds,
          }
        );

        if (othersError) throw othersError;
      }

      setCurrentConversationId(conversationId);
      toast({ title: "Conversation created" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating conversation",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar
        user={user}
        currentConversationId={currentConversationId}
        onConversationSelect={setCurrentConversationId}
        onNewConversation={handleNewConversation}
      />
      <ChatArea
        user={user}
        conversationId={currentConversationId}
        onCall={initiateCall}
        isCalling={isCalling}
      />
      <UserSelectDialog
        open={showUserSelect}
        onOpenChange={setShowUserSelect}
        currentUser={user}
        onSelect={handleCreateConversation}
      />
      
      {/* Incoming call dialog */}
      <IncomingCallDialog
        open={!!incomingCall}
        callerName={incomingCall?.caller_profile?.display_name || null}
        callerAvatar={incomingCall?.caller_profile?.avatar_url || null}
        onAnswer={answerCall}
        onDecline={declineCall}
      />
      
      {/* Active call overlay */}
      {activeCall?.status === "accepted" && (
        <ActiveCall
          participantName={
            activeCall.caller_id === user.id
              ? null
              : incomingCall?.caller_profile?.display_name || null
          }
          participantAvatar={
            activeCall.caller_id === user.id
              ? null
              : incomingCall?.caller_profile?.avatar_url || null
          }
          onEndCall={endCall}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
        />
      )}
    </div>
  );
};

export default Chat;