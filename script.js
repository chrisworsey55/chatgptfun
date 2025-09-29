const input = document.getElementById("inputText");
const slidesEl = document.getElementById("slides");
const generateBtn = document.getElementById("generateBtn");
const presentBtn = document.getElementById("presentBtn");
const pdfBtn = document.getElementById("pdfBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const themeSelect = document.getElementById("themeSelect");

}

function renderSlides() {
  slidesEl.innerHTML = "";

    slidesEl.appendChild(card);
  });
}


function startPresentation() {
  if (!slides.length) generate();
  document.documentElement.classList.add("present");
  current = 0;

}

function endPresentation() {
  document.documentElement.classList.remove("present");

