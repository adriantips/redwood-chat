import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface IncomingCallDialogProps {
  open: boolean;
  callerName: string | null;
  callerAvatar: string | null;
  onAnswer: () => void;
  onDecline: () => void;
}

const IncomingCallDialog = ({
  open,
  callerName,
  callerAvatar,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <div className="flex flex-col items-center space-y-6 py-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Avatar className="w-24 h-24 border-4 border-primary">
              <AvatarImage src={callerAvatar || undefined} />
              <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                {callerName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="text-center space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {callerName || "Unknown"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Incoming voice call...
            </DialogDescription>
          </div>

          <div className="flex gap-6">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
              onClick={onDecline}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
              onClick={onAnswer}
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallDialog;
