import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const GIPHY_API_KEY = "XRJ4IikCROHLkqgsjs3kroEivTBQZm51";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface GiphyGif {
  id: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
    fixed_width_small: { url: string };
  };
  title: string;
}

const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<GiphyGif[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Load trending on mount
  useEffect(() => {
    const loadTrending = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
        );
        const data = await res.json();
        setTrending(data.data || []);
      } catch (err) {
        console.error("Failed to load trending GIFs:", err);
      }
      setLoading(false);
    };
    loadTrending();
  }, []);

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) {
      setGifs([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error("GIF search failed:", err);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(val), 400);
  };

  const displayGifs = query.trim() ? gifs : trending;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 w-[320px] bg-card border-2 border-border rounded-xl shadow-xl overflow-hidden z-50"
    >
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search GIFs..."
            className="pl-8 h-9 text-sm"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {query.trim() ? "No GIFs found" : "Loading..."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1">
            {displayGifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  onSelect(gif.images.original.url);
                  onClose();
                }}
                className="rounded-md overflow-hidden hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="px-2 py-1 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">Powered by GIPHY</p>
      </div>
    </div>
  );
};

export default GifPicker;