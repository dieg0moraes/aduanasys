import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  icon?: LucideIcon;
}

export function KPICard({ label, value, trend, icon: Icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 flex-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
          {label}
        </span>
        {Icon && <Icon size={18} className="text-[#A1A1AA]" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[#18181B]">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              trend.positive
                ? "bg-[#F0FDF4] text-[#16A34A]"
                : "bg-[#FEF2F2] text-[#DC2626]"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
