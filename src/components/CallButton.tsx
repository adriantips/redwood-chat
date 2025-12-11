import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CallButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isCalling?: boolean;
}

const CallButton = ({ onClick, disabled, isCalling }: CallButtonProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={disabled || isCalling}
            className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
          >
            {isCalling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Phone className="w-5 h-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Start voice call</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CallButton;
