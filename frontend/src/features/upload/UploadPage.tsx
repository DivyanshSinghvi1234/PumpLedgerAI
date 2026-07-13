import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Sparkles,
  FileImage,
  X,
  Loader,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";

import {
  uploadInvoice,
  uploadErrorMessage,
} from "./services/uploadService";

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const navigate = useNavigate();

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);

  function handleFile(file: File) {
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    stopCamera();
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    handleFile(file);

    e.target.value = "";
  }

  async function openCamera() {
    setCameraLoading(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      cameraInputRef.current?.click();
    } finally {
      setCameraLoading(false);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }

  function captureSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      handleFile(file);
    }, "image/jpeg", 0.92);
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
  ) {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];

    if (!file) return;

    handleFile(file);
  }

  async function handleUpload() {
    if (!image) return;

    try {
      setLoading(true);
      setError("");

      const result = await uploadInvoice(image);

      navigate("/dashboard/review", {
        state: result,
      });
    } catch (err) {
      console.error(err);
      setError(uploadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function clearImage() {
    setImage(null);
    setPreview("");
    setError("");
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl">

      <PageHeader
        title="Upload Invoice"
        description="Drag & drop or capture an invoice image for AI-powered OCR extraction."
      />

      {/* Drop zone */}
      <div
        className={`relative flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragActive
            ? "drag-zone-active border-fuel-amber"
            : "border-hairline-strong hover:border-ink-tertiary bg-surface-1/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
      >
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
          dragActive ? "bg-fuel-amber/15 text-fuel-amber" : "bg-surface-3 border border-hairline text-ink-subtle"
        }`}>
          <Upload size={24} />
        </div>

        <p className="mt-4 text-sm font-semibold text-ink">
          Drag & drop your invoice here
        </p>

        <p className="mt-1 text-xs text-ink-subtle">
          or use the buttons below to select a file
        </p>

        <p className="mt-3 text-[10px] font-mono text-ink-tertiary uppercase tracking-wider">
          Supports JPG, PNG, WEBP · Max 10MB
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-ink transition cursor-pointer"
        >
          <ImageIcon size={18} />
          Choose from device
        </button>

        <button
          type="button"
          onClick={openCamera}
          disabled={cameraLoading}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-ink transition cursor-pointer disabled:opacity-50"
        >
          {cameraLoading ? <Loader size={18} className="animate-spin" /> : <Camera size={18} />}
          {cameraLoading ? "Opening camera..." : "Scan with camera"}
        </button>
      </div>

      {/* Camera preview */}
      {cameraStream && (
        <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <Camera size={16} />
              </div>
              <p className="text-sm font-medium text-ink">Camera preview</p>
            </div>
            <button
              onClick={stopCamera}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-3 text-ink-subtle hover:text-ink transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-h-[50vh] w-full rounded-lg object-contain bg-black"
            />
          </div>

          <div className="border-t border-hairline px-5 py-4">
            <button
              onClick={captureSnapshot}
              className="shine mx-auto flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber px-6 py-2.5 text-sm font-bold text-canvas transition shadow-lg shadow-fuel-amber/20 cursor-pointer"
            >
              <Camera size={16} />
              Capture Photo
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} hidden />

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={handleChange}
      />
      <input
        ref={cameraInputRef}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />

      {/* Preview card */}
      {preview && (
        <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden animate-fade-in-up">
          {/* Preview header */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <FileImage size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {image?.name || "camera-capture.jpg"}
                </p>
                <p className="text-[11px] text-ink-subtle font-mono">
                  {image ? (image.size / 1024 / 1024).toFixed(2) : "0"} MB
                </p>
              </div>
            </div>
            <button
              onClick={clearImage}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-3 text-ink-subtle hover:text-ink transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Image */}
          <div className="p-4">
            <img
              src={preview}
              alt="Invoice Preview"
              className="max-h-[50vh] w-full rounded-lg object-contain bg-surface-2"
            />
          </div>

          {/* Action bar */}
          <div className="border-t border-hairline px-5 py-4 flex items-center justify-between gap-4">
            {error && (
              <div className="flex-1 rounded-lg bg-error-muted border border-error/20 px-3 py-2 text-xs font-medium text-error flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-error" />
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading}
              className="shine ml-auto flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber px-6 py-2.5 text-sm font-bold text-canvas disabled:opacity-50 transition shadow-lg shadow-fuel-amber/20 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <Sparkles size={16} />
                  Process with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
