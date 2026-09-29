import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Condiciones del servicio · Gym Progress",
  description: "Condiciones de uso de Gym Progress.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Qué es Gym Progress",
    paragraphs: [
      "Una aplicación personal y gratuita para registrar entrenamientos de gimnasio: planes por día, series, repeticiones y peso, con el historial de sesiones anteriores.",
      "La desarrolla y mantiene Kenrique Ortega a título particular. No hay empresa detrás, ni suscripción, ni publicidad.",
    ],
  },
  {
    title: "No es consejo médico ni deportivo",
    paragraphs: [
      "La aplicación registra lo que tú introduces y, a partir de ahí, puede sugerirte cuándo subir peso. Esas sugerencias son un cálculo automático sobre tus propios números, no una recomendación profesional.",
      "No sustituyen a un entrenador, un fisioterapeuta ni un médico. Entrenar con cargas conlleva riesgo de lesión, y la responsabilidad de lo que levantes es tuya. Si tienes una condición de salud o dudas sobre tu técnica, consulta a un profesional.",
    ],
  },
  {
    title: "Tu cuenta",
    paragraphs: [
      "Se accede con una cuenta de Google. Eres responsable de mantener segura esa cuenta, ya que quien tenga acceso a ella podrá ver y modificar tus entrenamientos.",
      "Puedes dejar de usar la aplicación cuando quieras y pedir el borrado de tus datos escribiendo a kenriortega@gmail.com.",
    ],
  },
  {
    title: "Uso aceptable",
    paragraphs: [
      "No intentes acceder a datos de otras personas, sobrecargar el servicio ni usar la aplicación para nada ilegal.",
      "Se puede suspender el acceso de quien incumpla lo anterior.",
    ],
  },
  {
    title: "Disponibilidad y garantías",
    paragraphs: [
      "El servicio se ofrece tal cual, sin garantía de disponibilidad. Puede haber cortes, mantenimientos o cambios sin aviso previo, y depende de proveedores externos como Vercel, Neon y Google.",
      "Aunque se hacen copias de seguridad, conviene que no consideres esta aplicación tu único registro si tus datos de entrenamiento te resultan críticos.",
    ],
  },
  {
    title: "Limitación de responsabilidad",
    paragraphs: [
      "En la medida que permita la ley aplicable, el desarrollador no responde por lesiones, pérdida de datos ni daños derivados del uso de la aplicación.",
    ],
  },
  {
    title: "Cambios",
    paragraphs: [
      "Estas condiciones pueden actualizarse. Los cambios se reflejarán en esta página junto con su fecha de última actualización.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Gym Progress"
      title="Condiciones del servicio"
      updatedAt="29 de septiembre de 2026"
      intro="Gym Progress es una aplicación personal y gratuita para llevar el registro de tus entrenamientos. Estas son las condiciones de uso."
      sections={SECTIONS}
    />
  );
}
