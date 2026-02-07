import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "admin-effects-global";

let channelInstance: ReturnType<typeof supabase.channel> | null = null;
let subscriberCount = 0;

export function getEffectsChannel() {
  if (!channelInstance) {
    channelInstance = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: true, ack: true } },
    });
  }
  return channelInstance;
}

export function subscribeEffectsChannel() {
  subscriberCount++;
  return getEffectsChannel();
}

export function unsubscribeEffectsChannel() {
  subscriberCount--;
  if (subscriberCount <= 0 && channelInstance) {
    supabase.removeChannel(channelInstance);
    channelInstance = null;
    subscriberCount = 0;
  }
}
