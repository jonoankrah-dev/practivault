export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  // Geometric mark: overlapping circle + wedge, "flow" inspired
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FieldFlow"
      className={className}
    >
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M12 24 Q20 10 28 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="24" r="2" fill="currentColor" />
    </svg>
  );
}

export function LogoWithWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={28} />
      <span className="font-semibold tracking-tight text-[15px]">FieldFlow</span>
    </div>
  );
}
