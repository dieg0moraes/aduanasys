interface StatusBadgeProps {
  label: string;
  color: "success" | "warning" | "error" | "blue" | "gray";
}

const COLOR_MAP = {
  success: { dot: "bg-[#16A34A]", text: "text-[#16A34A]" },
  warning: { dot: "bg-[#F59E0B]", text: "text-[#F59E0B]" },
  error: { dot: "bg-[#DC2626]", text: "text-[#DC2626]" },
  blue: { dot: "bg-[#2563EB]", text: "text-[#2563EB]" },
  gray: { dot: "bg-[#A1A1AA]", text: "text-[#71717A]" },
};

export function StatusBadge({ label, color }: StatusBadgeProps) {
  const c = COLOR_MAP[color];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span className={`text-xs font-medium ${c.text}`}>{label}</span>
    </span>
  );
}
