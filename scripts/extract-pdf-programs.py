"""Extrae las tablas de la referencia, sin interpretar ni completar las celdas.

Uso: python extract-pdf-programs.py /ruta/Rutina-freq-2x-4ds-1.pdf
Requiere pdfplumber solo para regenerar los datos; no se usa en la aplicación.
"""
import hashlib
import json
from pathlib import Path
import sys

import pdfplumber

source = Path(sys.argv[1])
program_ids = [
    "equilibrio-torso-pierna-4-dias", "especializacion-brazos-4-dias",
    "agenda-flexible-4-dias", "fuerza-musculo-4-dias",
    "especializacion-hombros-4-dias",
]
groups = {
    "Glúteos": ["Abducción en máquina", "Hip Thrust en máquina", "Patadas de glúteo"],
    "Abdomen": ["Abwheel"],
    "Pecho": ["Aperturas en máquina", "Press multipower banco a 30º", "Press plano en máquina", "Press w/ mancuernas, banco a 15º"],
    "Bíceps": ["Curl bayesian en polea", "Curl desde polea baja", "Curl martillo", "Curl predicador"],
    "Tríceps": ["Extensiones desde polea alta", "Extensiones katana en polea", "Kaz press", "Pushdown desde polea alta", "Pushdown en polea alta"],
    "Espalda": ["Helms Row con mancuernas", "Jalón al pecho agarre prono", "Jalón al pecho agarres independientes", "Remo T para trapecios"],
    "Hombros": ["Deltoides posterior en máquina", "Deltoides posterior en polea", "Elevaciones laterales desde polea baja", "Elevaciones laterales polea altura rodilla", "Remo al mentón"],
    "Piernas": ["Aductor en máquina", "Extensión de rodillas en máquina", "Extensión de tobillos de pie (en multipower mismo)", "Extensión de tobillos sentado (en multipower mismo)", "Leg curl sentado", "Leg curl tumbado", "Peso muerto rumano", "Prensa 45º", "RDL con mancuernas", "Sentadilla hack"],
}
muscles = {name: group for group, names in groups.items() for name in names}
data = {"source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "programs": [{"id": key, "sessions": []} for key in program_ids]}
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 20
    for page_index, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        assert len(tables) == 1
        table = tables[0]
        session = {"page": page_index + 1, "heading": table[0][0], "exercises": []}
        for row in table[2:]:
            assert len(row) == 9 and all(isinstance(cell, str) and cell.strip() for cell in row)
            name = " ".join(row[0].split())
            session["exercises"].append({"name": name, "muscleGroup": muscles[name],
                                         "loadType": "bodyweight" if name == "Abwheel" else "external",
                                         "microcycles": [cell.strip() for cell in row[1:]]})
        data["programs"][page_index % 5]["sessions"].append(session)
output = Path(__file__).resolve().parents[1] / "src/lib/pdf-programs.json"
output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"Extraídas 20 páginas en {output}")
