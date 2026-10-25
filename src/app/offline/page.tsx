import type { Metadata } from "next";
import { OfflineHome } from "@/components/offline-home";

export const metadata: Metadata = { title: "Sin conexión · Gym Progress" };
export default function OfflinePage() { return <OfflineHome />; }
