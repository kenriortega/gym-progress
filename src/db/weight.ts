import { sql, type SQLWrapper } from "drizzle-orm";
import { LB_TO_KG } from "../lib/weight-units";

/** Normalizar cada serie antes de agregar máximos o volúmenes entre sesiones. */
export function weightInKgSql(weight: SQLWrapper, unit: SQLWrapper) {
  return sql<string>`(${weight} * case when ${unit} = 'lb' then ${LB_TO_KG}::numeric else 1::numeric end)`;
}
