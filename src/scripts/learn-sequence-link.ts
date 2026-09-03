if (window.location.pathname === "/learn" || window.location.pathname === "/learn/") {
  const intro = document.querySelector<HTMLElement>("#learn-intro");
  if (intro && !document.querySelector("[data-lesson-sequence-link]")) {
    const row = document.createElement("p");
    row.dataset.lessonSequenceLink = "true";
    const link = document.createElement("a");
    link.href = "/learn/sequence";
    link.className = "new-session-button";
    link.textContent = "Try grouped lesson sequence";
    row.append(link);
    intro.insertAdjacentElement("afterend", row);
  }
}
