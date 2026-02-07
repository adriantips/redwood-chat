import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminPanel from "./AdminPanel";

const SECRET = "adrianisthegoat";

const AdminPanelGlobal = () => {
  const [showAdmin, setShowAdmin] = useState(false);
  const secretBuffer = useRef("");
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      secretBuffer.current += e.key.toLowerCase();
      if (secretBuffer.current.length > SECRET.length) {
        secretBuffer.current = secretBuffer.current.slice(-SECRET.length);
      }
      if (secretBuffer.current === SECRET) {
        setShowAdmin(true);
        secretBuffer.current = "";
        toast({ title: "🔥 Admin mode activated!" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toast]);

  if (!showAdmin) return null;

  return <AdminPanel onClose={() => setShowAdmin(false)} />;
};

export default AdminPanelGlobal;
