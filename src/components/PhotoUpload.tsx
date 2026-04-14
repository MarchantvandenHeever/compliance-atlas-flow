import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, MapPin, Clock, ImageIcon, Compass, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import exifr from 'exifr';

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

interface ExtractedMeta {
  gps?: string;
  date?: string;
  cameraMake?: string;
  cameraModel?: string;
  orientation?: number;
  imageWidth?: number;
  imageHeight?: number;
  altitude?: number;
  direction?: number;
}

async function extractMetadata(file: File): Promise<ExtractedMeta> {
  const result: ExtractedMeta = {};
  try {
    const exif = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      pick: [
        'DateTimeOriginal', 'CreateDate', 'ModifyDate',
        'Make', 'Model',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSImgDirection',
        'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
        'Orientation',
      ],
    } as any);

    if (!exif) return result;

    // GPS
    if (exif.latitude != null && exif.longitude != null) {
      result.gps = `${exif.latitude.toFixed(6)}, ${exif.longitude.toFixed(6)}`;
    }
    if (exif.GPSAltitude != null) {
      result.altitude = Math.round(exif.GPSAltitude);
    }
    if (exif.GPSImgDirection != null) {
      result.direction = Math.round(exif.GPSImgDirection);
    }

    // Date
    const dateVal = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
    if (dateVal) {
      result.date = dateVal instanceof Date ? dateVal.toISOString() : String(dateVal);
    }

    // Camera
    if (exif.Make) result.cameraMake = String(exif.Make).trim();
    if (exif.Model) result.cameraModel = String(exif.Model).trim();

    // Dimensions
    result.imageWidth = exif.ExifImageWidth || exif.ImageWidth;
    result.imageHeight = exif.ExifImageHeight || exif.ImageHeight;
    result.orientation = exif.Orientation;
  } catch {
    // EXIF parsing failed — non-critical
  }
  return result;
}

export default function PhotoUpload({ responseId, photos, onPhotosChange, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detect camera availability
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setHasCamera(devices.some(d => d.kind === 'videoinput'));
      }).catch(() => setHasCamera(false));
    } else {
      // Fallback: show camera button on mobile/tablet (touch devices)
      setHasCamera('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
  }, []);

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

        // Extract comprehensive EXIF metadata
        const meta = await extractMetadata(file);

        // Fallback to browser geolocation if EXIF GPS unavailable
        let gpsLocation = meta.gps;
        if (!gpsLocation && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
              });
            });
            gpsLocation = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
            if (pos.coords.altitude != null && !meta.altitude) {
              meta.altitude = Math.round(pos.coords.altitude);
            }
          } catch {
            // GPS unavailable
          }
        }

        // Build caption with camera info
        let autoCaption = '';
        if (meta.cameraMake || meta.cameraModel) {
          const cam = [meta.cameraMake, meta.cameraModel].filter(Boolean).join(' ');
          autoCaption = cam;
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

        const { data: signedUrlData } = await supabase.storage.from('audit-photos').createSignedUrl(path, 3600);

        newPhotos.push({
          url: signedUrlData?.signedUrl || '',
          caption: autoCaption,
          gpsLocation,
          exifDate: meta.date || new Date().toISOString(),
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
        {hasCamera && (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Camera size={12} /> Take Photo
          </button>
        )}
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
        onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
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
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground flex-wrap">
                  {photo.gpsLocation && (
                    <span className="flex items-center gap-0.5"><MapPin size={8} /> {photo.gpsLocation}</span>
                  )}
                  {photo.exifDate && (
                    <span className="flex items-center gap-0.5"><Clock size={8} /> {new Date(photo.exifDate).toLocaleString()}</span>
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
