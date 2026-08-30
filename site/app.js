const summary = document.querySelector('#summary');
const items = document.querySelector('#items');
const run = document.querySelector('#run');
async function replay() {
  run.disabled = true; run.textContent = 'Replaying…';
  const report = await fetch('./demo-report.json').then((response) => response.json());
  summary.innerHTML = `<article><strong>${report.summary.simulated}/${report.summary.total}</strong><span>items simulated</span></article><article><strong>${report.summary.externalWrites}</strong><span>external writes</span></article><article><strong>${report.mode}</strong><span>execution mode</span></article>`;
  items.replaceChildren();
  report.items.forEach((item, index) => {
    const card = document.createElement('article'); card.className = 'item';
    card.innerHTML = `<div><span class="number">${String(index + 1).padStart(2, '0')}</span><h3>${item.label}</h3><span class="status">${item.status}</span></div><p class="schedule">${item.scheduledFor ? `Scheduled: ${item.scheduledFor}` : 'Immediate visibility path'}</p><ol>${item.steps.map((step) => `<li><b>${step.name}</b><span>${step.detail}</span></li>`).join('')}</ol>`;
    items.append(card);
  });
  run.disabled = false; run.textContent = 'Replay again';
}
run.addEventListener('click', replay); replay();
