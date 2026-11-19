import { lexer } from './markdown.js';

export function enlaceNotaSeguro(valor) {
  const url = String(valor || '').trim();
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(url) ? url : '';
}

// Convertir a texto y rangos permite usar la misma nota en el editor y en PNG.
// El HTML del usuario permanece como texto y nunca se inserta en el documento.
export function interpretarMarkdownNota(original, formato) {
  // Los fragmentos de código y los caracteres escapados ya convertidos siguen
  // siendo literales cuando se vuelve a abrir o editar la nota.
  const caracteres = original.split('');
  for (const rango of formato.rangos) {
    if (!rango.codigo && !rango.literalMarkdown) continue;
    for (let i = rango.inicio; i < rango.fin; i++) {
      if (!/\s/.test(caracteres[i])) caracteres[i] = 'a';
    }
  }
  const fuenteLexica = caracteres.join('');
  const tokens = lexer(fuenteLexica, {gfm: true});
  const tipos = new Set(['heading', 'strong', 'em', 'del', 'code', 'codespan',
    'list', 'blockquote', 'table', 'link', 'image', 'escape', 'hr', 'br']);
  const contieneFormato = lista => lista.some(token => tipos.has(token.type) ||
    (token.tokens && contieneFormato(token.tokens)));
  if (!contieneFormato(tokens)) return {texto: original, formato};

  let texto = '';
  const rangos = [];
  const agregar = (contenido, posicion, estilo = {}) => {
    if (!contenido) return;
    let indice = 0;
    while (indice < contenido.length) {
      const fuente = Math.min(original.length - 1, Math.max(0, posicion + indice));
      const previo = formato.rangos.find(r => r.inicio <= fuente && r.fin > fuente);
      const cantidad = previo ? Math.min(contenido.length - indice, previo.fin - fuente) : contenido.length - indice;
      const inicio = texto.length;
      texto += contenido.slice(indice, indice + cantidad);
      const base = previo || {tamano: formato.tamano};
      rangos.push({
        ...base, ...estilo, inicio, fin: texto.length,
        bold: !!(base.bold || estilo.bold),
        italic: !!(base.italic || estilo.italic),
        underline: !!(base.underline || estilo.underline),
        tachado: !!(base.tachado || estilo.tachado),
        codigo: !!(base.codigo || estilo.codigo),
        tamano: Math.min(160, (base.tamano || formato.tamano) * (estilo.escala || 1))
      });
      indice += cantidad;
    }
  };
  const saltos = (raw, posicion) => {
    const final = raw.match(/\n+$/)?.[0];
    if (final) agregar(final, posicion + raw.length - final.length);
  };
  const recorrer = (lista, desde = 0, estilo = {}, profundidad = 0) => {
    let cursor = desde;
    for (const token of lista) {
      const raw = token.raw || token.text || '';
      const encontrado = fuenteLexica.indexOf(raw, cursor);
      const inicio = encontrado < 0 ? cursor : encontrado;
      cursor = inicio + raw.length;
      const hijos = cambios => recorrer(token.tokens || [], inicio, {...estilo, ...cambios}, profundidad);
      switch (token.type) {
        case 'strong': hijos({bold: true}); break;
        case 'em': hijos({italic: true}); break;
        case 'del': hijos({tachado: true}); break;
        case 'heading':
          hijos({bold: true, escala: [1, 1.6, 1.4, 1.25, 1.15, 1.1, 1][token.depth] || 1});
          saltos(raw, inicio);
          break;
        case 'blockquote':
          hijos({italic: true});
          saltos(raw, inicio);
          break;
        case 'list': {
          let numero = Number(token.start) || 1;
          let lugar = inicio;
          token.items.forEach((item, i) => {
            if (i) agregar('\n', lugar, estilo);
            const indice = fuenteLexica.indexOf(item.raw, lugar);
            lugar = indice < 0 ? lugar : indice;
            const prefijo = token.ordered ? numero++ + '. ' : item.task ? (item.checked ? '☑ ' : '☐ ') : '• ';
            agregar('  '.repeat(profundidad) + prefijo, lugar, estilo);
            recorrer(item.tokens, lugar, estilo, profundidad + 1);
            lugar += item.raw.length;
          });
          saltos(raw, inicio);
          break;
        }
        case 'link':
          hijos({enlace: enlaceNotaSeguro(token.href), underline: true});
          break;
        case 'image':
          agregar(token.text || '', inicio, estilo);
          break;
        case 'code':
        case 'codespan': {
          const offset = fuenteLexica.indexOf(token.text, inicio);
          const posicion = offset < 0 ? inicio : offset;
          agregar(original.slice(posicion, posicion + token.text.length), posicion, {...estilo, codigo: true});
          if (token.type === 'code') saltos(raw, inicio);
          break;
        }
        case 'table': {
          const filas = [token.header, ...token.rows];
          filas.forEach((fila, i) => {
            if (i) agregar('\n', inicio, estilo);
            fila.forEach((celda, j) => {
              if (j) agregar('  |  ', inicio, estilo);
              recorrer(celda.tokens, inicio, {...estilo, bold: i === 0 || estilo.bold}, profundidad);
            });
          });
          saltos(raw, inicio);
          break;
        }
        case 'paragraph':
          hijos({});
          saltos(raw, inicio);
          break;
        case 'text':
          if (token.tokens) hijos({});
          else agregar(encontrado < 0 ? token.text : original.slice(inicio, inicio + raw.length), inicio, estilo);
          break;
        case 'br': agregar('\n', inicio, estilo); break;
        case 'hr': agregar('—\n', inicio, estilo); break;
        case 'def': break;
        case 'escape': agregar(token.text, inicio + 1, {...estilo, literalMarkdown: true}); break;
        default: agregar(encontrado < 0 ? raw : original.slice(inicio, inicio + raw.length), inicio, estilo);
      }
    }
  };
  recorrer(tokens);
  return {texto, formato: {...formato, rangos}};
}
