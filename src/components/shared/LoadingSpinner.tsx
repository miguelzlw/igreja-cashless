"use client";

export function LoadingSpinner({ size = "md", text }: { size?: "sm" | "md" | "lg"; text?: string }) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-10 h-10 border-3",
    lg: "w-14 h-14 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-primary/30 border-t-primary rounded-full animate-spin`}
      />
      {text && (
        <p className="text-sm text-[hsl(var(--text-secondary))] animate-pulse-soft">{text}</p>
      )}
    </div>
  );
}

export function FullPageLoading({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--bg))]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
