import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad · Gym Progress",
  description:
    "Qué datos guarda Gym Progress, para qué los usa y cómo pedir que se borren.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Quién trata tus datos",
    paragraphs: [
      "Gym Progress es una aplicación personal desarrollada y mantenida por Kenrique Ortega. No hay empresa detrás ni terceros con acceso a los datos.",
      "Para cualquier consulta sobre tus datos: kenriortega@gmail.com.",
    ],
  },
  {
    title: "Qué datos recogemos",
    paragraphs: [
      "De tu cuenta de Google, únicamente tu nombre, tu dirección de correo y la URL de tu foto de perfil. Es lo mínimo que permite identificarte al entrar. No pedimos acceso a tu correo, tu calendario, tus contactos ni tus archivos.",
      "De tu uso de la aplicación: los planes de entrenamiento que creas, los ejercicios que registras, y el peso, las repeticiones y la fecha de cada serie.",
      "No usamos cookies de publicidad ni herramientas de analítica. No recogemos tu ubicación.",
    ],
  },
  {
    title: "Para qué los usamos",
    paragraphs: [
      "Únicamente para que la aplicación funcione: mantener tu sesión iniciada, mostrarte tu historial y calcular tu progreso.",
      "No vendemos, alquilamos ni compartimos tus datos con nadie. No se usan para publicidad ni para entrenar modelos.",
    ],
  },
  {
    title: "Dónde se guardan",
    paragraphs: [
      "En una base de datos PostgreSQL alojada en Neon, en servidores de Estados Unidos, y la aplicación se sirve desde Vercel. Ambos actúan como proveedores de infraestructura y están sujetos a sus propias políticas de privacidad.",
      "La conexión con la base de datos va cifrada, y el acceso a la aplicación se sirve siempre por HTTPS.",
    ],
  },
  {
    title: "Cuánto tiempo los conservamos",
    paragraphs: [
      "Mientras tengas la cuenta activa. Si pides que se borre, se eliminan tu usuario y todos tus entrenamientos de forma permanente, sin copia residual más allá de las copias de seguridad rutinarias, que se rotan periódicamente.",
    ],
  },
  {
    title: "Tus derechos",
    paragraphs: [
      "Puedes pedir una copia de tus datos, su corrección o su borrado completo escribiendo a kenriortega@gmail.com. Atenderemos la petición en un plazo razonable.",
      "También puedes revocar el acceso de la aplicación a tu cuenta de Google en cualquier momento desde la configuración de seguridad de tu cuenta de Google.",
    ],
  },
  {
    title: "Menores",
    paragraphs: [
      "La aplicación no está dirigida a menores de 14 años y no recoge datos de forma consciente de personas de esa edad.",
    ],
  },
  {
    title: "Cambios en esta política",
    paragraphs: [
      "Si cambia algo relevante, se actualizará esta página y su fecha de última actualización.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Gym Progress"
      title="Política de privacidad"
      updatedAt="29 de septiembre de 2026"
      intro="Gym Progress guarda lo mínimo imprescindible para funcionar: quién eres y qué levantaste. Nada más, y nada se comparte con terceros."
      sections={SECTIONS}
    />
  );
}
