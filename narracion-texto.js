export function conPausasNarracion(valor = "") {
  return String(valor || "").replace(/\r\n?/g, "\n").trim()
    .split(/(\n[\t ]*\n+)/).map((parte, indice) => {
      if (indice % 2) return parte;
      const texto = parte.trimEnd();
      if (!texto.trim()) return texto;
      // La puntuación puede estar antes de una comilla o un paréntesis de cierre.
      const final = texto.replace(/["'»”’\])}]+$/u, "");
      return /[.!?…:;]$/u.test(final) ? texto : texto + ".";
    }).join("");
}

export const VOZ_VERSICULO_DEVOCIONAL = "es-US-Neural2-B";
export const VOZ_COMENTARIO_NARRACION = "es-US-Wavenet-C";

export function segmentosDevocional(p1 = {}, p2 = {}) {
  const segmentos = [
    {tipo: "comentario", texto: ["Devocional.", conPausasNarracion(p1.fecha)].filter(Boolean).join("\n")},
    {tipo: "biblia", texto: p1.versiculo},
    {tipo: "comentario", texto: p1.cita},
    {tipo: "comentario", texto: p2.reflexion ? "Reflexión: " + p2.reflexion : ""},
    {tipo: "comentario", texto: p2.oracion ? "Oración: " + p2.oracion : ""}
  ];
  return segmentos.map(seg => ({...seg, texto: conPausasNarracion(seg.texto)})).filter(seg => seg.texto);
}
