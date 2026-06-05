export default function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="6" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="6" y="10" width="20" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <path d="M10 16h12M10 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="12" r="2" fill="currentColor" opacity="0.6" />
      <path d="M3 6l4-3h18l4 3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
