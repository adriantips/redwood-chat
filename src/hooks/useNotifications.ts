import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export const useNotifications = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    // Only show if permission granted and tab is not focused
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });

      if (onClick) {
        notification.onclick = () => {
          window.focus();
          notification.close();
          onClick();
        };
      }

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }, []);

  const notifyMessage = useCallback((senderName: string, messagePreview: string) => {
    sendNotification(`New message from ${senderName}`, messagePreview);
  }, [sendNotification]);

  const notifyCall = useCallback((callerName: string, onAnswer?: () => void) => {
    sendNotification(`Incoming call from ${callerName}`, "Click to answer", onAnswer);
  }, [sendNotification]);

  const requestPermission = useCallback(async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({
          title: "Notifications disabled",
          description: "Enable notifications to receive alerts for calls and messages.",
        });
      }
      return permission === "granted";
    }
    return false;
  }, [toast]);

  return { sendNotification, notifyMessage, notifyCall, requestPermission };
};
