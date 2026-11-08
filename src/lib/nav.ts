/**
 * Reglas de la barra de destinos, fuera del componente para poder probarlas:
 * marcar la sección equivocada o asomar la barra en el acceso son fallos que
 * no avisan, y comprobarlos no necesita navegador.
 */

/** Pantallas que no son la aplicación: ahí la barra no lleva a ninguna parte. */
export const NAV_EXCLUDED = ["/login", "/privacidad", "/terminos", "/offline", "/abrir"];

/** `/plans` marca también `/plans/loquesea`; `/` solo se marca a sí misma. */
export const navActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export const navHidden = (pathname: string) => NAV_EXCLUDED.includes(pathname);
