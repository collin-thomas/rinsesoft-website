const form = document.getElementById("check-form") as HTMLFormElement;
const questions = document.getElementById("questions") as HTMLElement;
const priority = document.getElementById("priority") as HTMLFieldSetElement;
const branches = [
  { value: "owner", field: document.getElementById("owner") as HTMLFieldSetElement },
  { value: "growth", field: document.getElementById("growth") as HTMLFieldSetElement },
  { value: "visibility", field: document.getElementById("visibility") as HTMLFieldSetElement },
];
const results = document.getElementById("results") as HTMLElement;
const outcomes = Array.from(results.children).filter(
  (element): element is HTMLElement => element instanceof HTMLElement,
);
const progress = document.getElementById("progress") as HTMLElement;
const controls = document.getElementById("controls") as HTMLElement;
const back = document.getElementById("back") as HTMLButtonElement;
const restart = document.getElementById("restart") as HTMLButtonElement;
const fallback = document.getElementById("fallback") as HTMLElement;
const instruction = document.getElementById("instruction") as HTMLElement;
let step: "priority" | "detail" | "result" = "priority";

function choice(name: string): string {
  const group = form.elements.namedItem(name);
  return group instanceof RadioNodeList ? group.value : "";
}

function render(moveFocus = false): void {
  const branch = branches.find((item) => item.value === choice("priority"));
  const outcome = branch && outcomes.find((item) => item.dataset.result === choice(branch.value));
  if (step !== "priority" && !branch) {
    throw new Error("The business check needs a priority before opening a follow-up.");
  }
  if (step === "result" && !outcome) {
    throw new Error("The business check has no starting point for this answer.");
  }
  fallback.hidden = true;
  progress.hidden = false;
  controls.hidden = false;
  instruction.hidden = false;
  questions.hidden = step === "result";
  priority.hidden = step !== "priority";
  priority.disabled = step !== "priority";
  for (const item of branches) {
    const active = step === "detail" && item === branch;
    item.field.hidden = !active;
    item.field.disabled = !active;
  }
  results.hidden = step !== "result";
  for (const item of outcomes) item.hidden = item !== outcome;
  back.hidden = step === "priority";
  restart.hidden = step === "priority";
  progress.textContent = step === "priority"
    ? "Question 1 of 2 · Choose one to continue"
    : step === "detail" ? "Question 2 of 2 · Choose what fits best" : "Your starting point";
  if (moveFocus) {
    if (step === "result") {
      outcome?.focus();
      outcome?.scrollIntoView({ block: "start" });
    } else {
      const field = step === "priority" ? priority : branch?.field;
      field?.querySelector("legend")?.focus();
    }
  }
}

function advance(): void {
  if (step === "result" || !form.reportValidity()) return;
  step = step === "priority" ? "detail" : "result";
  render(true);
}

form.addEventListener("change", advance);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  advance();
});
back.addEventListener("click", () => {
  step = step === "result" ? "detail" : "priority";
  const field = step === "priority"
    ? priority : branches.find((item) => item.value === choice("priority"))?.field;
  for (const input of field?.querySelectorAll("input") ?? []) input.checked = false;
  render(true);
});
restart.addEventListener("click", () => {
  form.reset();
  step = "priority";
  render(true);
});
window.addEventListener("pageshow", () => render());
render();
