import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[#A1A1AA]">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-[#2563EB] font-medium hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#71717A] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
