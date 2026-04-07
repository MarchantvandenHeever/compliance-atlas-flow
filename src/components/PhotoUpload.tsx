import { useState, useRef } from 'react';
import { Camera, Upload, X, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhotoData {
  id?: string;
  url: string;
  caption: string;
  gpsLocation?: string;
  exifDate?: string;
  storagePath: string;
}

interface PhotoUploadProps {
  responseId?: string;
  photos: PhotoData[];
  onPhotosChange: (photos: PhotoData[]) => void;
  disabled?: boolean;
}

// Extract EXIF data from image file
async function extractExif(file: File): Promise<{ gps?: string; date?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target?.result as ArrayBuffer);
        // Check for JPEG
        if (view.getUint16(0) !== 0xFFD8) {
          resolve({});
          return;
        }

        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) {
            // EXIF marker found
            const exifData = parseExifSegment(view, offset + 4);
            resolve(exifData);
            return;
          }
          offset += 2 + view.getUint16(offset + 2);
        }
        resolve({});
      } catch {
        resolve({});
      }
    };
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024)); // Read first 128KB for EXIF
  });
}

function parseExifSegment(view: DataView, start: number): { gps?: string; date?: string } {
  try {
    // Basic EXIF parsing - look for DateTimeOriginal and GPS
    const exifStr = String.fromCharCode(...new Uint8Array(view.buffer.slice(start, start + 4)));
    if (exifStr !== 'Exif') return {};

    const tiffStart = start + 6;
    const bigEndian = view.getUint16(tiffStart) === 0x4D4D;

    const getUint16 = (o: number) => bigEndian ? view.getUint16(o) : view.getUint16(o, true);
    const getUint32 = (o: number) => bigEndian ? view.getUint32(o) : view.getUint32(o, true);

    let result: { gps?: string; date?: string } = {};

    // Parse IFD0
    const ifdOffset = tiffStart + getUint32(tiffStart + 4);
    const entries = getUint16(ifdOffset);

    for (let i = 0; i < entries; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      const tag = getUint16(entryOffset);

      // DateTimeOriginal tag in SubIFD (0x9003) or DateTime (0x0132)
      if (tag === 0x0132) {
        const valueOffset = tiffStart + getUint32(entryOffset + 8);
        const dateStr = String.fromCharCode(
          ...new Uint8Array(view.buffer.slice(valueOffset, valueOffset + 19))
        );
        result.date = dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      }
    }

    return result;
  } catch {
    return {};
  }
}

export default function PhotoUpload({ responseId, photos, onPhotosChange, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const newPhotos: PhotoData[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB limit`);
          continue;
        }

        // Extract EXIF
        const exif = await extractExif(file);

        // Get GPS from browser if EXIF GPS not available
        let gpsLocation = exif.gps;
        if (!gpsLocation && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            gpsLocation = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
          } catch {
            // GPS unavailable
          }
        }

        // Upload to Supabase Storage
        const ext = file.name.split('.').pop();
        const path = `${responseId || 'temp'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('audit-photos')
          .upload(path, file, { cacheControl: '3600' });

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage.from('audit-photos').getPublicUrl(path);

        newPhotos.push({
          url: urlData.publicUrl,
          caption: '',
          gpsLocation,
          exifDate: exif.date || new Date().toISOString(),
          storagePath: path,
        });
      }

      if (newPhotos.length > 0) {
        onPhotosChange([...photos, ...newPhotos]);
        toast.success(`${newPhotos.length} photo(s) uploaded`);
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (index: number) => {
    const photo = photos[index];
    if (photo.storagePath) {
      await supabase.storage.from('audit-photos').remove([photo.storagePath]);
    }
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    const updated = [...photos];
    updated[index] = { ...updated[index], caption };
    onPhotosChange(updated);
  };

  return (
    <div className="space-y-2">
      {/* Upload buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Camera size={12} /> Camera
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-background text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <Upload size={12} /> Upload
        </button>
        {uploading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
            Uploading...
          </span>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFileSelect(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFileSelect(e.target.files)}
      />

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={i} className="relative group border rounded-md overflow-hidden bg-muted">
              <img
                src={photo.url}
                alt={photo.caption || `Photo ${i + 1}`}
                className="w-full h-24 object-cover"
                loading="lazy"
              />
              {!disabled && (
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              )}
              <div className="p-1.5 space-y-1">
                <input
                  type="text"
                  value={photo.caption}
                  onChange={e => updateCaption(i, e.target.value)}
                  placeholder="Add caption..."
                  disabled={disabled}
                  className="w-full text-[10px] px-1 py-0.5 bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  {photo.gpsLocation && (
                    <span className="flex items-center gap-0.5"><MapPin size={8} /> {photo.gpsLocation}</span>
                  )}
                  {photo.exifDate && (
                    <span className="flex items-center gap-0.5"><Clock size={8} /> {new Date(photo.exifDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
