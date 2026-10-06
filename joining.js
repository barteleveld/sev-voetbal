// Inhoud en contactgegevens hebben één bron: de leesbare voetbalvormen in de HTML.
export function initJoiningRoute(root = document) {
  const panel = root.querySelector("#proeftraining");
  if (!panel) return;
  const title = panel.querySelector("[data-trial-title]");
  const copy = panel.querySelector("[data-trial-copy]");
  const contact = panel.querySelector("[data-trial-contact]");
  const placeholder = panel.querySelector("[data-trial-placeholder]");
  if (!title || !copy || !contact || !placeholder) return;

  root.querySelectorAll("[data-join-choice]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = link.closest("[data-joining-route]");
      const description = route?.querySelector("[data-joining-description]");
      const sourceContact = route?.querySelector("[data-joining-contact]");
      if (!route || !description || !sourceContact) return;
      event.preventDefault();

      title.textContent = `Kennismaken met ${route.dataset.joiningLabel}.`;
      copy.textContent = description.textContent;
      contact.replaceChildren(sourceContact.cloneNode(true));
      copy.hidden = false;
      contact.hidden = false;
      placeholder.hidden = true;
      root.querySelectorAll("[data-joining-route]").forEach((item) => {
        item.classList.toggle("is-selected", item === route);
      });
      // Zonder script werkt de ankerlink. Met script volgt ook de toetsenbordfocus.
      const view = link.ownerDocument.defaultView;
      if (view && view.location.hash !== "#proeftraining") {
        view.history.pushState(null, "", "#proeftraining");
      }
      panel.scrollIntoView({ block: "start" });
      title.focus({ preventScroll: true });
    });
  });
}
