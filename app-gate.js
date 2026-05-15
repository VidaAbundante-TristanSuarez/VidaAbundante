/* ================= APP GATE DESACTIVADO ================= */
/* No redirige a login. No muestra cartel. No hace nada. */

(function(){
  window.VAAppGate = {
    continuarSinLogin: function(){
      window.location.href = "/VidaAbundante/";
    },
    entradaLimpia: function(){},
    mostrar: function(){},
    cerrar: function(){},
    resetPrueba: function(){}
  };
})();
