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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const { toast } = useToast();
  const { notifyCall } = useNotifications();

  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const callChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  // Cleanup everything
  const endCallCleanup = useCallback(() => {
    console.log("[Call] Cleaning up...");
    localStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    localStream.current = null;
    screenStream.current = null;
    pendingCandidates.current = [];

    if (callChannel.current) {
      supabase.removeChannel(callChannel.current);
      callChannel.current = null;
    }

    setActiveCall(null);
    setIncomingCall(null);
    setIsCalling(false);
    setIsScreenSharing(false);
  }, []);

  // Get user media
  const acquireMedia = useCallback(async () => {
    if (localStream.current) return localStream.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  // Join the shared signaling channel for a call
  const joinCallChannel = useCallback(
    (callId: string, targetUserId: string, isInitiator: boolean) => {
      if (callChannel.current) {
        supabase.removeChannel(callChannel.current);
      }

      const channelName = `call-${callId}`;
      console.log("[Call] Joining signaling channel:", channelName, "initiator:", isInitiator);

      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false, ack: true } },
      });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.from === user?.id) return;
          console.log("[Call] Received offer");
          try {
            const pc = peerConnection.current;
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            // Add any pending ICE candidates
            for (const c of pendingCandidates.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("[Call] Sending answer");
            channel.send({ type: "broadcast", event: "answer", payload: { answer, from: user?.id } });
          } catch (err) {
            console.error("[Call] Error handling offer:", err);
          }
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from === user?.id) return;
          console.log("[Call] Received answer");
          const pc = peerConnection.current;
          if (!pc) return;
          try {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
              // Add any pending ICE candidates
              for (const c of pendingCandidates.current) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              pendingCandidates.current = [];
            }
          } catch (err) {
            console.error("[Call] Error handling answer:", err);
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.from === user?.id) return;
          const pc = peerConnection.current;
          if (!pc) return;
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              // Queue candidate until remote description is set
              pendingCandidates.current.push(payload.candidate);
            }
          } catch (err) {
            console.error("[Call] Error adding ICE candidate:", err);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            console.log("[Call] Channel subscribed, isInitiator:", isInitiator);
            if (isInitiator) {
              // Small delay to ensure both sides are subscribed
              setTimeout(async () => {
                try {
                  const pc = peerConnection.current;
                  if (!pc) return;
                  console.log("[Call] Creating and sending offer...");
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  channel.send({ type: "broadcast", event: "offer", payload: { offer, from: user?.id } });
                } catch (err) {
                  console.error("[Call] Error creating offer:", err);
                }
              }, 1000);
            }
          }
        });

      callChannel.current = channel;
    },
    [user?.id]
  );

  // Create peer connection
  const createPC = useCallback(
    (stream: MediaStream) => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }

      const pc = new RTCPeerConnection(iceServers);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log("[Call] Remote track received");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callChannel.current) {
          callChannel.current.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate, from: user?.id },
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Call] ICE state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected") {
          console.log("[Call] ✅ Connected!");
        }
        if (pc.iceConnectionState === "failed") {
          console.log("[Call] ❌ ICE failed, restarting...");
          pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Call] Connection state:", pc.connectionState);
      };

      peerConnection.current = pc;
      return pc;
    },
    [user?.id]
  );

  // Subscribe to call DB changes (incoming calls + status updates)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("calls-db-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const call = payload.new as Call;
          if (call.status === "ringing") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", call.caller_id)
              .maybeSingle();
            setIncomingCall({ ...call, caller_profile: profile || undefined });
            notifyCall(profile?.display_name || "Someone");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `caller_id=eq.${user.id}` },
        async (payload) => {
          const call = payload.new as Call;
          if (call.status === "accepted") {
            console.log("[Call] Call accepted by receiver, starting WebRTC as caller...");
            setActiveCall((prev) => (prev?.id === call.id ? { ...prev, status: "accepted", started_at: call.started_at } : prev));
            try {
              const stream = await acquireMedia();
              createPC(stream);
              joinCallChannel(call.id, call.receiver_id, true);
            } catch (err) {
              console.error("[Call] Media error:", err);
              toast({ variant: "destructive", title: "Camera/Mic access denied" });
              endCallCleanup();
            }
          } else if (call.status === "declined" || call.status === "ended") {
            toast({ title: call.status === "declined" ? "Call declined" : "Call ended" });
            endCallCleanup();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const call = payload.new as Call;
          if (call.status === "ended") {
            endCallCleanup();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, acquireMedia, createPC, joinCallChannel, endCallCleanup, toast, notifyCall]);

  const initiateCall = useCallback(
    async (conversationId: string, receiverIds: string | string[]) => {
      if (!user || isCalling) return;
      const receivers = Array.isArray(receiverIds) ? receiverIds : [receiverIds];
      if (receivers.length === 0) return;

      setIsCalling(true);
      try {
        const { data, error } = await supabase
          .from("calls")
          .insert({ conversation_id: conversationId, caller_id: user.id, receiver_id: receivers[0], status: "ringing" })
          .select()
          .single();
        if (error) throw error;
        setActiveCall(data);
        toast({ title: "Calling..." });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Failed to start call", description: error.message });
        setIsCalling(false);
      }
    },
    [user, isCalling, toast]
  );

  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;
    try {
      const stream = await acquireMedia();
      createPC(stream);

      const { error } = await supabase
        .from("calls")
        .update({ status: "accepted", started_at: new Date().toISOString() })
        .eq("id", incomingCall.id);
      if (error) throw error;

      setActiveCall({ ...incomingCall, status: "accepted" });
      setIncomingCall(null);

      // Join signaling channel as receiver (not initiator)
      joinCallChannel(incomingCall.id, incomingCall.caller_id, false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to answer call", description: error.message });
      endCallCleanup();
    }
  }, [incomingCall, user, acquireMedia, createPC, joinCallChannel, toast, endCallCleanup]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", incomingCall.id);
    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(async () => {
    if (!activeCall) return;
    await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", activeCall.id);
    endCallCleanup();
  }, [activeCall, endCallCleanup]);

  const toggleVideo = useCallback(() => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; return track.enabled; }
    return false;
  }, []);

  const toggleAudio = useCallback(() => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; return track.enabled; }
    return false;
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!activeCall) return false;
    try {
      if (isScreenSharing) {
        screenStream.current?.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
        const videoTrack = localStream.current?.getVideoTracks()[0];
        if (videoTrack) {
          const sender = peerConnection.current?.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(videoTrack);
        }
        if (localVideoRef.current && localStream.current) localVideoRef.current.srcObject = localStream.current;
        setIsScreenSharing(false);
        return false;
      } else {
        screenStream.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = screenStream.current.getVideoTracks()[0];
        const sender = peerConnection.current?.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream.current;
        screenTrack.onended = () => { toggleScreenShare(); };
        setIsScreenSharing(true);
        return true;
      }
    } catch (error) {
      console.error("[Call] Screen share error:", error);
      toast({ variant: "destructive", title: "Screen sharing failed" });
      return isScreenSharing;
    }
  }, [activeCall, isScreenSharing, toast]);

  return {
    activeCall,
    incomingCall,
    isCalling,
    isScreenSharing,
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
