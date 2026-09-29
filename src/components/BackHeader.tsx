import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackHeader({ title, href = "/dashboard" }: { title: string; href?: string }) {
  return (
    <header className="mb-6 flex items-center gap-3">
      <Link href={href} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-surface-2">
        <ChevronLeft size={20} />
      </Link>
      <h1 className="text-xl font-semibold">{title}</h1>
    </header>
  );
}
