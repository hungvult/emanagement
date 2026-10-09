import NextImage from "next/image";
import { ScanFace } from "lucide-react";
import React from "react";

export function InfoRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-transparent hover:border-slate-100 group">
      <div className="text-slate-400 shrink-0 group-hover:text-indigo-500 transition-colors bg-white p-1.5 rounded-md shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-500 mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-bold text-slate-900 truncate ${valueClassName || ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function FaceImageCard({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all group">
      <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden relative">
        {url ? (
          <NextImage
            unoptimized
            width={640}
            height={480}
            src={url}
            alt={label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <ScanFace className="h-8 w-8 opacity-30" />
            <span className="text-[11px] font-semibold">Chưa có ảnh</span>
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-slate-900/5 pointer-events-none"></div>
      </div>
      <div className="px-3 py-2.5 bg-white text-center border-t border-slate-50">
        <span className="text-sm font-bold text-slate-700">{label}</span>
      </div>
    </div>
  );
}
