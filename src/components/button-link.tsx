import Link from "next/link";

import { Button } from "@/components/ui/button";

type ButtonLinkProps = Omit<React.ComponentProps<typeof Button>, "render"> &
  Pick<React.ComponentProps<typeof Link>, "href" | "prefetch" | "replace">;

/**
 * Un enlace con aspecto de botón.
 *
 * El Button de Base UI asume que renderiza un <button> nativo y avisa si le
 * das otra cosa. Con un enlace hay que desactivar esa expectativa, y tenerlo
 * aquí evita repetirlo —y olvidarlo— en cada sitio.
 */
export function ButtonLink({
  href,
  prefetch,
  replace,
  ...props
}: ButtonLinkProps) {
  return (
    <Button
      {...props}
      nativeButton={false}
      render={<Link href={href} prefetch={prefetch} replace={replace} />}
    />
  );
}
