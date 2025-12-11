import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "./useNotifications";

interface Call {
  id: string;
  conversation_id: string;
  caller_id: string;
  receiver_id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  caller_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useCalling = (user: User | null) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const { toast } = useToast();
  const { notifyCall } = useNotifications();
  
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as Call;
          
          if (payload.eventType === "INSERT" && call.status === "ringing") {
            // Fetch caller profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", call.caller_id)
              .maybeSingle();
            
            const callWithProfile = { ...call, caller_profile: profile || undefined };
            setIncomingCall(callWithProfile);
            notifyCall(profile?.display_name || "Someone");
          } else if (payload.eventType === "UPDATE") {
            if (call.status === "ended" || call.status === "declined") {
              endCallCleanup();
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `caller_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as Call;
          
          if (call.status === "accepted" && activeCall?.id === call.id) {
            setActiveCall({ ...activeCall, status: "accepted", started_at: call.started_at });
            // Start WebRTC connection as caller
            await startWebRTC(call.id, true);
          } else if (call.status === "declined" || call.status === "ended") {
            toast({
              title: call.status === "declined" ? "Call declined" : "Call ended",
            });
            endCallCleanup();
          }
        }
      )
      .subscribe();

    // Also subscribe to signaling channel
    const signalingChannel = supabase
      .channel(`signaling-${user.id}`)
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (peerConnection.current && payload.callId === activeCall?.id) {
          await peerConnection.current.setRemoteDescription(payload.offer);
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          
          supabase.channel(`signaling-${payload.from}`).send({
            type: "broadcast",
            event: "answer",
            payload: { answer, callId: payload.callId, from: user.id },
          });
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (peerConnection.current && payload.callId === activeCall?.id) {
          await peerConnection.current.setRemoteDescription(payload.answer);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (peerConnection.current && payload.callId === activeCall?.id) {
          await peerConnection.current.addIceCandidate(payload.candidate);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(signalingChannel);
    };
  }, [user, activeCall?.id]);

  const startWebRTC = async (callId: string, isInitiator: boolean) => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current?.addTrack(track, localStream.current!);
      });

      peerConnection.current.ontrack = (event) => {
        remoteStream.current = event.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play();
        }
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate && activeCall) {
          const targetId = isInitiator ? activeCall.receiver_id : activeCall.caller_id;
          supabase.channel(`signaling-${targetId}`).send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate, callId, from: user?.id },
          });
        }
      };

      if (isInitiator) {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        
        if (activeCall) {
          supabase.channel(`signaling-${activeCall.receiver_id}`).send({
            type: "broadcast",
            event: "offer",
            payload: { offer, callId, from: user?.id },
          });
        }
      }
    } catch (error) {
      console.error("WebRTC error:", error);
      toast({
        variant: "destructive",
        title: "Microphone access denied",
        description: "Please allow microphone access to make calls.",
      });
    }
  };

  const initiateCall = useCallback(async (conversationId: string, receiverId: string) => {
    if (!user || isCalling) return;

    setIsCalling(true);
    try {
      const { data, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          receiver_id: receiverId,
          status: "ringing",
        })
        .select()
        .single();

      if (error) throw error;

      setActiveCall(data);
      toast({ title: "Calling..." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to start call",
        description: error.message,
      });
      setIsCalling(false);
    }
  }, [user, isCalling, toast]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    try {
      const { error } = await supabase
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", incomingCall.id);

      if (error) throw error;

      setActiveCall(incomingCall);
      setIncomingCall(null);
      
      // Start WebRTC as receiver
      await startWebRTC(incomingCall.id, false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to answer call",
        description: error.message,
      });
    }
  }, [incomingCall, user, toast]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from("calls")
        .update({ status: "declined", ended_at: new Date().toISOString() })
        .eq("id", incomingCall.id);

      setIncomingCall(null);
    } catch (error: any) {
      console.error("Failed to decline call:", error);
    }
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await supabase
        .from("calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", activeCall.id);

      endCallCleanup();
    } catch (error: any) {
      console.error("Failed to end call:", error);
    }
  }, [activeCall]);

  const endCallCleanup = () => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    peerConnection.current?.close();
    localStream.current = null;
    remoteStream.current = null;
    peerConnection.current = null;
    setActiveCall(null);
    setIncomingCall(null);
    setIsCalling(false);
  };

  return {
    activeCall,
    incomingCall,
    isCalling,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    audioRef,
  };
};
