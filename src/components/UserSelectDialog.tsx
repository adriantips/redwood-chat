import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Loader2 } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UserSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  onSelect: (userIds: string[]) => void;
}

const UserSelectDialog = ({ open, onOpenChange, currentUser, onSelect }: UserSelectDialogProps) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
      setSelectedUsers([]);
    }
  }, [open]);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .neq("id", currentUser.id);

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleConfirm = () => {
    if (selectedUsers.length > 0) {
      onSelect(selectedUsers);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No other users available
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      selectedUsers.includes(user.id)
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {(user.display_name?.[0] || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left font-medium">
                      {user.display_name || "Unknown User"}
                    </span>
                    {selectedUsers.includes(user.id) && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Button
              onClick={handleConfirm}
              disabled={selectedUsers.length === 0}
              className="w-full"
            >
              Start Chat ({selectedUsers.length} selected)
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserSelectDialog;
