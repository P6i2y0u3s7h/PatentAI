import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, X } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  selectedFile,
  onClearFile,
  disabled = false,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  if (selectedFile) {
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[#05070D]/90 border border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.2)]">
        <div className="flex items-center gap-3.5 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center border border-cyan-500/30 flex-shrink-0 text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div className="overflow-hidden text-left">
            <p className="text-sm font-medium text-slate-100 truncate">{selectedFile.name}</p>
            <p className="text-xs text-cyan-400/80 font-mono">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClearFile}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
          title="Remove file"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01] shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]'
          : 'border-white/[0.12] hover:border-cyan-500/40 bg-[#05070D]/60 hover:bg-[#05070D]/90'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/25 text-cyan-400 shadow-sm">
          <UploadCloud size={24} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {isDragActive ? 'Drop PDF file here' : 'Drag & drop patent PDF file here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">or click to browse from computer (Max 20MB)</p>
        </div>
      </div>
    </div>
  );
};
