import type { ComponentProps } from "react";

/** El worker sirve un documento/fallback completo cuando no hay red. */
export function DocumentLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
