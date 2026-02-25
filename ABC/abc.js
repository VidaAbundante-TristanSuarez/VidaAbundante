// ================= ABC - MÓDULO =================

const ABC_TEMAS = [
  {
    html: "ABC/INTRO.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2Fintro_abc.mp3?alt=media&token=c51321da-2f7f-4092-b90d-a61df6da671a"
  },
  {
    html: "ABC/1 Salvación.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F1%20Salvaci%C3%B3n.mp3?alt=media&token=7da0ae0f-da01-4a58-8ae0-5e0a037c8076"
  },
  {
    titulo: "PECADO",
    html: "ABC/2 Pecado.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F2%20Pecado.mp3?alt=media&token=54fe4210-37e9-4cf0-b0bf-c7f0564e881f"
  },
  {
    titulo: "LA PALABRA",
    html: "ABC/3 La Palabra.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F3%20La%20Palabra.mp3?alt=media&token=73fbd70f-e008-47de-b557-28fcd6a5ac36"
  },
  {
    titulo: "LA ORACIÓN",
    html: "ABC/4 La Oración.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F4%20La%20Oraci%C3%B3n.mp3?alt=media&token=096b3b09-6179-4c80-8718-a800954907b3"
  },
  {
    titulo: "ESPÍRITU SANTO",
    html: "ABC/5 Espíritu Santo.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F5%20Esp%C3%ADritu%20Santo.mp3?alt=media&token=68ad750b-4449-433f-b7dc-be457879c61f"
  },
  {
    titulo: "BAUTISMO",
    html: "ABC/6 Bautismo.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F6%20Bautismo.mp3?alt=media&token=e85836f1-9f5d-42be-83de-93797cdf3c22"
  },
  {
    titulo: "LA MAYORDOMÍA",
    html: "ABC/7 La Mayordomía.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F7%20La%20Mayordom%C3%ADa.mp3?alt=media&token=4994a81a-be99-4f39-8bd3-9888df880fcf"
  },
  {
    titulo: "EVANGELISMO",
    html: "ABC/8 Evangelismo.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F8%20Evangelismo.mp3?alt=media&token=4d197527-1f36-4378-9389-5e248e44533b"
  },
  {
    titulo: "VISIÓN DE LA IGLESIA",
    html: "ABC/9 La visión de la iglesia.html",
    audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F9%20La%20vision%20de%20la%20iglesia.mp3?alt=media&token=c81cd672-6fd8-46df-b086-e564fed73974"
  }
];

let abcIndex = 0;

window.mostrarABC = async () => {
  const cont = document.getElementById("abcApp");
  if (!cont) return;

  cont.innerHTML = `
    <div style="max-width:720px;margin:0 auto;padding:20px;">
      <h2 id="abcTitulo" style="text-align:center"></h2>

      <div style="text-align:center;margin:10px 0;">
        <button onclick="abcPrev()">⟨ Anterior</button>
        <button onclick="abcNext()">Siguiente ⟩</button>
      </div>

      <audio id="abcAudio" controls style="width:100%;margin:15px 0;"></audio>

      <div id="abcContenido" style="background:#fff;padding:20px;border-radius:12px;"></div>
    </div>
  `;

  await cargarABCTema();
};

async function cargarABCTema() {
  const tema = ABC_TEMAS[abcIndex];

  document.getElementById("abcTitulo").textContent = tema.titulo;
  document.getElementById("abcAudio").src = tema.audio;

  const r = await fetch(encodeURI(tema.html));
  const html = await r.text();

  document.getElementById("abcContenido").innerHTML = html;
}

window.abcNext = () => {
  if (abcIndex < ABC_TEMAS.length - 1) {
    abcIndex++;
    cargarABCTema();
  }
};

window.abcPrev = () => {
  if (abcIndex > 0) {
    abcIndex--;
    cargarABCTema();
  }
};
