import { UsersIcon, VenusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TemplateAudience } from "@/lib/plan-templates";

const AUDIENCES = {
  mixto: { label: "Mixto", Icon: UsersIcon },
  mujeres: { label: "Mujeres", Icon: VenusIcon },
  general: { label: "General", Icon: UsersIcon },
};

export function TemplateAudienceBadge({ audience }: { audience: TemplateAudience | "general" }) {
  const { label, Icon } = AUDIENCES[audience];
  return (
    <Badge variant={audience === "mujeres" ? "default" : "secondary"}>
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </Badge>
  );
}
