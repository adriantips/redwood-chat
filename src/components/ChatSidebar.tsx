import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MessageSquare, LogOut, User as UserIcon, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  user: User;
  currentConversationId: string | null;
  onConversationSelect: (id: string | null) => void;
  onNewConversation: () => void;
}

const ChatSidebar = ({ user, currentConversationId, onConversationSelect, onNewConversation }: ChatSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
    
    const channel = supabase
      .channel('sidebar-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        conversations (
          id,
          title,
          updated_at
        )
      `)
      .eq("user_id", user.id)
      .order("conversations(updated_at)", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error loading conversations",
        description: error.message,
      });
      return;
    }

    const convos = data
      ?.map((item: any) => item.conversations)
      .filter((conv: any) => conv !== null) || [];
    
    setConversations(convos);
  };

  const handleRename = (conv: Conversation) => {
    setSelectedConversation(conv);
    setNewTitle(conv.title || "");
    setRenameDialogOpen(true);
  };

  const handleDelete = (conv: Conversation) => {
    setSelectedConversation(conv);
    setDeleteDialogOpen(true);
  };

  const confirmRename = async () => {
    if (!selectedConversation || !newTitle.trim()) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title: newTitle.trim() })
        .eq("id", selectedConversation.id);

      if (error) throw error;

      toast({ title: "Chat renamed" });
      setRenameDialogOpen(false);
      setSelectedConversation(null);
      setNewTitle("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error renaming chat",
        description: error.message,
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedConversation) return;

    try {
      // Delete messages first
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", selectedConversation.id);

      // Delete participants
      await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", selectedConversation.id);

      // Delete conversation
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", selectedConversation.id);

      if (error) throw error;

      // Clear selection if deleted conversation was selected
      if (currentConversationId === selectedConversation.id) {
        onConversationSelect(null);
      }

      toast({ title: "Chat deleted" });
      setDeleteDialogOpen(false);
      setSelectedConversation(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting chat",
        description: error.message,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground">ChatFlow</span>
        </div>
        <Button onClick={onNewConversation} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-1 rounded-lg transition-colors ${
                currentConversationId === conv.id
                  ? "bg-sidebar-accent"
                  : "hover:bg-sidebar-accent/50"
              }`}
            >
              <button
                onClick={() => onConversationSelect(conv.id)}
                className={`flex-1 text-left px-3 py-2 ${
                  currentConversationId === conv.id
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {conv.title || "New Conversation"}
                  </span>
                </div>
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleRename(conv)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(conv)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user.email?.[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/profile")}
          variant="ghost"
          className="w-full justify-start text-sm"
          size="sm"
        >
          <UserIcon className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full justify-start text-sm"
          size="sm"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter chat name"
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatSidebar;
