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

interface Participant {
  oderId: string;
  displayName: string | null;
  stream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
}

export const useCalling = (user: User | null) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const { toast } = useToast();
  const { notifyCall } = useNotifications();
  
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callsChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // Cleanup function
  const endCallCleanup = useCallback(() => {
    console.log("Cleaning up call...");
    
    // Stop all tracks
    localStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
    
    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    
    localStream.current = null;
    screenStream.current = null;
    setParticipants(new Map());
    setActiveCall(null);
    setIncomingCall(null);
    setIsCalling(false);
    setIsScreenSharing(false);
  }, []);

  const sendSignal = useCallback((targetUserId: string, event: string, payload: any) => {
    const targetChannel = supabase.channel(`signaling-${targetUserId}`);
    targetChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        targetChannel.send({
          type: "broadcast",
          event,
          payload,
        });
        // Unsubscribe after a short delay to avoid leaking channels
        setTimeout(() => supabase.removeChannel(targetChannel), 2000);
      }
    });
  }, []);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback((targetUserId: string, callId: string): RTCPeerConnection => {
    console.log("Creating peer connection for:", targetUserId);
    
    const pc = new RTCPeerConnection(iceServers);
    
    // Add local tracks
    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
    });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log("Received remote track from:", targetUserId);
      const stream = event.streams[0];
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      
      setParticipants((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(targetUserId);
        newMap.set(targetUserId, {
          oderId: targetUserId,
          displayName: existing?.displayName || null,
          stream,
          peerConnection: pc,
        });
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", targetUserId);
        sendSignal(targetUserId, "ice-candidate", {
          candidate: event.candidate,
          callId,
          from: user?.id,
          to: targetUserId,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.log("ICE connection failed/disconnected");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
    };

    peerConnections.current.set(targetUserId, pc);
    return pc;
  }, [user?.id, sendSignal]);

  // Start WebRTC connection
  const startWebRTC = useCallback(async (callId: string, targetUserId: string, isInitiator: boolean) => {
    try {
      console.log("Starting WebRTC, isInitiator:", isInitiator, "target:", targetUserId);
      
      // Get user media if not already available
      if (!localStream.current) {
        localStream.current = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
      }

      const pc = createPeerConnection(targetUserId, callId);

      if (isInitiator) {
        console.log("Creating and sending offer...");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignal(targetUserId, "offer", {
          offer,
          callId,
          from: user?.id,
          to: targetUserId,
        });
      }
    } catch (error) {
      console.error("WebRTC error:", error);
      toast({
        variant: "destructive",
        title: "Camera/Microphone access denied",
        description: "Please allow camera and microphone access to make video calls.",
      });
      endCallCleanup();
    }
  }, [user?.id, createPeerConnection, toast, endCallCleanup]);

  // Setup signaling channel
  useEffect(() => {
    if (!user) return;

    console.log("Setting up signaling channel for user:", user.id);
    
    signalingChannel.current = supabase.channel(`signaling-${user.id}`);
    
    signalingChannel.current
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        console.log("Received offer from:", payload.from);
        if (payload.to !== user.id) return;
        
        const pc = peerConnections.current.get(payload.from) || createPeerConnection(payload.from, payload.callId);
        
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          sendSignal(payload.from, "answer", {
            answer,
            callId: payload.callId,
            from: user.id,
            to: payload.from,
          });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        console.log("Received answer from:", payload.from);
        if (payload.to !== user.id) return;
        
        const pc = peerConnections.current.get(payload.from);
        if (pc && pc.signalingState !== "stable") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } catch (err) {
            console.error("Error setting remote description:", err);
          }
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        
        const pc = peerConnections.current.get(payload.from);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        }
      })
      .subscribe();

    return () => {
      if (signalingChannel.current) {
        supabase.removeChannel(signalingChannel.current);
      }
    };
  }, [user, createPeerConnection]);

  // Subscribe to call updates
  useEffect(() => {
    if (!user) return;

    callsChannel.current = supabase
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
            console.log("Call accepted, starting WebRTC as caller...");
            setActiveCall({ ...activeCall, status: "accepted", started_at: call.started_at });
            await startWebRTC(call.id, call.receiver_id, true);
          } else if (call.status === "declined" || call.status === "ended") {
            toast({
              title: call.status === "declined" ? "Call declined" : "Call ended",
            });
            endCallCleanup();
          }
        }
      )
      .subscribe();

    return () => {
      if (callsChannel.current) {
        supabase.removeChannel(callsChannel.current);
      }
    };
  }, [user, activeCall?.id, startWebRTC, endCallCleanup, toast, notifyCall]);

  const initiateCall = useCallback(async (conversationId: string, receiverIds: string | string[]) => {
    if (!user || isCalling) return;

    const receivers = Array.isArray(receiverIds) ? receiverIds : [receiverIds];
    if (receivers.length === 0) return;

    setIsCalling(true);
    try {
      // For group calls, we'd create multiple call entries or a single group call
      // For now, supporting the first receiver (can be extended for group)
      const { data, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          receiver_id: receivers[0],
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
      // Get media first before accepting
      localStream.current = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

      const { error } = await supabase
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", incomingCall.id);

      if (error) throw error;

      setActiveCall({ ...incomingCall, status: "accepted" });
      setIncomingCall(null);
      
      // Start WebRTC as receiver - wait a bit for caller to be ready
      setTimeout(() => {
        startWebRTC(incomingCall.id, incomingCall.caller_id, false);
      }, 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to answer call",
        description: error.message,
      });
      endCallCleanup();
    }
  }, [incomingCall, user, toast, startWebRTC, endCallCleanup]);

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
      endCallCleanup();
    }
  }, [activeCall, endCallCleanup]);

  const toggleVideo = useCallback(() => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!activeCall) return false;

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        screenStream.current?.getTracks().forEach((track) => track.stop());
        screenStream.current = null;
        
        // Replace screen track with camera track
        const videoTrack = localStream.current?.getVideoTracks()[0];
        if (videoTrack) {
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }
        
        if (localVideoRef.current && localStream.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
        
        setIsScreenSharing(false);
        return false;
      } else {
        // Start screen sharing
        screenStream.current = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: false,
        });

        const screenTrack = screenStream.current.getVideoTracks()[0];
        
        // Replace camera track with screen track
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream.current;
        }

        // Handle user stopping screen share via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        return true;
      }
    } catch (error) {
      console.error("Screen share error:", error);
      toast({
        variant: "destructive",
        title: "Screen sharing failed",
        description: "Could not start screen sharing.",
      });
      return isScreenSharing;
    }
  }, [activeCall, isScreenSharing, toast]);

  return {
    activeCall,
    incomingCall,
    isCalling,
    isScreenSharing,
    participants,
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    localVideoRef,
    remoteVideoRef,
  };
};
