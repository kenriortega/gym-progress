"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  HouseIcon,
  LaptopIcon,
  LogOutIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

/**
 * Secciones del menú. Añadir una entrada nueva (Ajustes, Unidades, Ejercicios
 * personalizados…) es agregar un objeto aquí, no tocar el componente.
 */
const NAV_SECTIONS: NavItem[][] = [
  [
    { href: "/", label: "Inicio", Icon: HouseIcon },
    { href: "/plans", label: "Planes", Icon: CalendarDaysIcon },
  ],
  [
    { href: "/progress", label: "Progreso", Icon: TrendingUpIcon },
    { href: "/history", label: "Historial", Icon: ClockIcon },
  ],
];

const THEMES = [
  { value: "light", label: "Claro", Icon: SunIcon },
  { value: "dark", label: "Oscuro", Icon: MoonIcon },
  { value: "system", label: "Sistema", Icon: LaptopIcon },
] as const;

type UserMenuProps = {
  name: string;
  email: string | null;
  image: string | null;
  signOutAction: () => Promise<void>;
};

export function UserMenu({ name, email, image, signOutAction }: UserMenuProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Abrir menú"
        >
          <Avatar className="size-11 border border-border shadow-sm transition hover:border-primary/60">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="bg-secondary text-sm font-black tracking-tight text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <div className="flex items-center gap-3 px-1.5 py-2">
            <Avatar className="size-9">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="bg-secondary text-xs font-black text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{name}</span>
              {email ? (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              ) : null}
            </span>
          </div>

          {NAV_SECTIONS.map((section, index) => (
            <DropdownMenuGroup key={index}>
              <DropdownMenuSeparator />
              {section.map(({ href, label, Icon }) => (
                <DropdownMenuItem
                  key={href}
                  render={<Link href={href} />}
                  data-active={pathname === href ? "" : undefined}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  {pathname === href ? (
                    <CheckIcon className="size-4 text-primary" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon className="size-4" />
              Apariencia
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {THEMES.map(({ value, label, Icon }) => (
                <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  {theme === value ? <CheckIcon className="size-4 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmingSignOut(true)}
          >
            <LogOutIcon className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingSignOut} onOpenChange={setConfirmingSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tus entrenamientos quedan guardados. Volverás a entrar con Google.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void signOutAction()}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
