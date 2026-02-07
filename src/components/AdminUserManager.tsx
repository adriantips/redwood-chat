import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Eye, EyeOff } from "lucide-react";

interface UserEntry {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface EditState {
  display_name: string;
  password: string;
  avatar_url: string;
}

const AdminUserManager = () => {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await supabase.functions.invoke("admin-users", {
        headers: { Authorization: `Bearer ${token}` },
        body: null,
        method: "GET",
      });

      // Use query params via direct fetch since invoke doesn't support query params well
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await response.json();
      
      if (data.users) {
        setUsers(data.users);
        const initialEdits: Record<string, EditState> = {};
        data.users.forEach((u: UserEntry) => {
          initialEdits[u.id] = {
            display_name: u.display_name || "",
            password: "",
            avatar_url: u.avatar_url || "",
          };
        });
        setEdits(initialEdits);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load users", description: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSave = async (userId: string) => {
    const edit = edits[userId];
    if (!edit) return;
    setSaving(userId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=update`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          display_name: edit.display_name,
          avatar_url: edit.avatar_url,
          ...(edit.password ? { password: edit.password } : {}),
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "✅ User updated!" });
      setEdits((prev) => ({ ...prev, [userId]: { ...prev[userId], password: "" } }));
      fetchUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
    setSaving(null);
  };

  const updateEdit = (userId: string, field: keyof EditState, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {users.map((user) => {
        const edit = edits[user.id];
        if (!edit) return null;
        return (
          <div key={user.id} className="border rounded-lg p-2.5 space-y-2 bg-background">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={edit.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(user.display_name || user.email)?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.display_name || user.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <Input
              value={edit.display_name}
              onChange={(e) => updateEdit(user.id, "display_name", e.target.value)}
              placeholder="Display name"
              className="text-xs h-8"
            />

            <div className="relative">
              <Input
                type={showPw[user.id] ? "text" : "password"}
                value={edit.password}
                onChange={(e) => updateEdit(user.id, "password", e.target.value)}
                placeholder="New password (leave empty to keep)"
                className="text-xs h-8 pr-8"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => ({ ...p, [user.id]: !p[user.id] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Input
              value={edit.avatar_url}
              onChange={(e) => updateEdit(user.id, "avatar_url", e.target.value)}
              placeholder="Avatar URL"
              className="text-xs h-8"
            />

            <Button
              onClick={() => handleSave(user.id)}
              disabled={saving === user.id}
              size="sm"
              className="w-full h-7 text-xs"
            >
              {saving === user.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default AdminUserManager;