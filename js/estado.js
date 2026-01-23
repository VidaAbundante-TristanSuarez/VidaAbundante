// ================= ESTADO GLOBAL =================
let uid = null;

let bibliaData = [];
let libroActual = null;
let capituloActual = null;

let marcados = {};
let notas = {};

let size = 18;
let colorActual = "#fff3b0";

let resaltadorBloqueado = false;
let grupoActual = null;
let marcador = null;

let modoImagen = false;
let seleccionImagen = {};
let fondoFinal = null;

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};
