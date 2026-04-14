import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin, Clock, Camera, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Photo {
  id: string;
  storage_path: string;
  caption?: string | null;
  gps_location?: string | null;
  exif_date?: string | null;
}

interface Props {
  photos: Photo[];
}

export default function PhotoEvidenceGallery({ photos }: Props) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const paths = photos.map(p => p.storage_path);
    supabase.storage
      .from('audit-photos')
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((item) => {
            if (item.signedUrl) map[item.path ?? ''] = item.signedUrl;
          });
          setSignedUrls(map);
        }
      });
  }, [photos]);

  if (!photos || photos.length === 0) return null;

  const selected = selectedIndex !== null ? photos[selectedIndex] : null;
  const selectedUrl = selected ? signedUrls[selected.storage_path] : null;

  const handleDownload = async () => {
    if (!selected) return;
    const { data } = await supabase.storage.from('audit-photos').download(selected.storage_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = selected.storage_path.split('/').pop() || 'photo.jpg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div className="mt-1">
        <p className="text-[10px] font-medium text-muted-foreground mb-1">
          <Camera size={10} className="inline mr-1" />
          Photo Evidence ({photos.length})
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {photos.map((photo, idx) => {
            const url = signedUrls[photo.storage_path];
            return (
              <button
                key={photo.id}
                onClick={() => setSelectedIndex(idx)}
                className="relative w-14 h-14 rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all group"
              >
                {url ? (
                  <img src={url} alt={photo.caption || 'Evidence'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted animate-pulse" />
                )}
                {photo.gps_location && (
                  <MapPin size={8} className="absolute top-0.5 right-0.5 text-primary drop-shadow" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selected && (
            <div className="flex flex-col">
              <div className="relative bg-black flex items-center justify-center min-h-[400px]">
                {selectedUrl ? (
                  <img
                    src={selectedUrl}
                    alt={selected.caption || 'Evidence photo'}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">Loading...</div>
                )}

                {photos.length > 1 && selectedIndex !== null && selectedIndex > 0 && (
                  <button
                    onClick={() => setSelectedIndex(selectedIndex - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                {photos.length > 1 && selectedIndex !== null && selectedIndex < photos.length - 1 && (
                  <button
                    onClick={() => setSelectedIndex(selectedIndex + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Photo {(selectedIndex ?? 0) + 1} of {photos.length}
                  </span>
                  <button
                    onClick={handleDownload}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>

                {selected.caption && (
                  <p className="text-sm">{selected.caption}</p>
                )}

                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  {selected.gps_location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {selected.gps_location}
                    </span>
                  )}
                  {selected.exif_date && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {new Date(selected.exif_date).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
